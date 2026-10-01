const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { initPluginRegistry, describeSources, getPlugin } = require('./plugins/registry');
const { loadSettings, saveSettings } = require('./settings');
const { searchSources, probeSource } = require('./core/search.cjs');
const { searchInputError } = require('./core/input.cjs');
const { createDownloadQueue, readDownloadLog } = require('./core/downloads.cjs');
const { rememberAssets, findAsset } = require('./core/asset-cache.cjs');

let mainWindow = null;
// batchId -> 队列控制器（暂停/继续/取消都在主进程里，界面重渲染不会丢任务）
const batches = new Map();

function createWindow(settings = loadSettings()) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    title: '素材下载器',
    icon: path.join(__dirname, '..', 'resources', 'app-icon.png'),
    backgroundColor: settings.theme === 'dark' ? '#0e1422' : '#f5f7fb',
    autoHideMenuBar: true,
    frame: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // 窗口控制（自绘标题栏）
  for (const ev of ['maximize', 'unmaximize']) {
    mainWindow.on(ev, () => mainWindow?.webContents.send('window:maximized', ev === 'maximize'));
  }

  if (process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL();
    if (currentUrl && url !== currentUrl) event.preventDefault();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    for (const batch of batches.values()) batch.cancel();
    batches.clear();
  });
}

const send = (channel, payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
};

// ── IPC ──

// 一次搜索 = 所有选中源并发，逐源落定即推送结果（不再等最慢的源）。
ipcMain.handle('search', async (event, { requestId, query, mediaType, sources, page, perPage, dedupe }) => {
  const settings = loadSettings();
  const guard = searchInputError({ query: String(query || '').trim() });
  if (guard) return { success: false, error: guard };
  try {
    const summary = await searchSources(
      { query, mediaType, sources, page, perPage },
      {
        settings,
        dedupe: typeof dedupe === 'boolean' ? dedupe : undefined,
        onSource: (group, items) => {
          rememberAssets(items, { query, page });
          send('search-source', { requestId, group, items });
        },
      },
    );
    return { success: true, ...summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '搜索失败' };
  }
});

ipcMain.handle('probe-source', async (_event, { name }) => {
  try {
    initPluginRegistry(loadSettings());
    const result = await probeSource(String(name || ''));
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '探测失败' };
  }
});

// 批量下载：并发上限 + 暂停/继续/取消，控制器留在主进程。
ipcMain.handle('download-start', async (_event, { items, destDir, query }) => {
  try {
    if (!Array.isArray(items) || items.length === 0) throw new Error('没有要下载的素材');
    const settings = loadSettings();
    const dir = typeof destDir === 'string' && destDir.trim() ? destDir.trim() : settings.downloadDir;
    if (!dir) throw new Error('请先在设置里选择下载目录');
    const batchId = `b${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const queue = createDownloadQueue(items, {
      destDir: dir,
      settings,
      query: String(query || ''),
      onEvent: (event) => send('download-event', { batchId, ...event }),
    });
    queue.batchId = batchId;
    batches.set(batchId, queue);
    queue.wait().then((result) => {
      send('download-event', { batchId, type: 'batch-done', result });
      batches.delete(batchId);
    });
    return { success: true, batchId, size: queue.size, jobs: queue.jobs };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '无法开始下载' };
  }
});

function batchControl(action) {
  return (_event, batchId) => {
    const queue = batches.get(String(batchId));
    if (!queue) return { success: false, error: '这一批任务已经结束或不存在' };
    return { success: true, ...queue[action]() };
  };
}

ipcMain.handle('download-pause', batchControl('pause'));
ipcMain.handle('download-resume', batchControl('resume'));
ipcMain.handle('download-cancel', batchControl('cancel'));

ipcMain.handle('download-log', async (_event, params = {}) => {
  try {
    return { success: true, ...readDownloadLog(params || {}) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '读取下载历史失败' };
  }
});

ipcMain.handle('asset-detail', async (_event, { source, sourceId }) => {
  const plugin = getPlugin(source);
  if (!plugin) return { success: false, error: `未知素材源：${source}` };
  if (plugin.supportsById && plugin.isConfigured()) {
    try {
      const fresh = await plugin.fetchById(String(sourceId));
      rememberAssets([fresh], { query: '' });
      return { success: true, data: fresh, live: true };
    } catch (err) {
      const cached = findAsset(source, sourceId);
      if (cached) return { success: true, data: cached, live: false, note: err.message };
      return { success: false, error: err instanceof Error ? err.message : '取详情失败' };
    }
  }
  const cached = findAsset(source, sourceId);
  if (cached) return { success: true, data: cached, live: false };
  return { success: false, error: `${plugin.displayName} 没有按 id 直取的接口，且这条素材不在最近搜索里 —— 先搜一次再取详情` };
});

ipcMain.handle('get-settings', async () => loadSettings());
ipcMain.handle('save-settings', async (_e, settings) => {
  try {
    const saved = saveSettings(settings);
    initPluginRegistry(saved);
    return { success: true, data: saved };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '设置保存失败' };
  }
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: '选择下载目录' });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-plugins', async () => describeSources());

ipcMain.handle('open-in-folder', async (_e, filePath) => { shell.showItemInFolder(filePath); });

// ── 窗口控制（自绘标题栏）──

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:toggle-maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  }
  mainWindow.maximize();
  return true;
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:is-maximized', () => !!mainWindow?.isMaximized());

// ── App ──

app.whenReady().then(() => {
  const settings = loadSettings();
  initPluginRegistry(settings);
  createWindow(settings);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow(loadSettings());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
