const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { initPluginRegistry, searchAll, downloadAsset, getRegisteredPlugins } = require('./plugins/registry');
const { loadSettings, saveSettings } = require('./settings');
const { createAgentApiServer, DEFAULT_PORT } = require('./agent-api.cjs');

let mainWindow = null;

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
}

// ── IPC ──

ipcMain.handle('search', async (_e, { query, mediaType, sources, page, perPage }) => {
  try {
    const safeQuery = String(query || '').trim().slice(0, 200);
    const safeType = ['image', 'video', 'all'].includes(mediaType) ? mediaType : 'image';
    const safeSources = Array.isArray(sources) ? sources.map(String).slice(0, 10) : [];
    const safePage = Math.max(1, Math.min(Number(page) || 1, 100));
    const safePerPage = Math.max(3, Math.min(Number(perPage) || 24, 80));
    if (!safeQuery) return { success: false, error: '请输入搜索关键词' };
    const { results, warnings } = await searchAll(safeQuery, safeType, safeSources, safePage, safePerPage);
    return { success: true, data: results, warnings };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '搜索失败' };
  }
});

ipcMain.handle('download', async (event, { item, destDir, taskId }) => {
  try {
    if (!item?.source || !item?.sourceId || !item?.downloadUrl) throw new Error('素材信息不完整');
    if (!destDir || typeof destDir !== 'string') throw new Error('请选择有效的下载目录');
    const filePath = await downloadAsset(item, destDir, (progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('download-progress', { taskId, progress });
      }
    });
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '下载失败' };
  }
});

ipcMain.handle('get-settings', async () => loadSettings());
ipcMain.handle('save-settings', async (_e, settings) => {
  try {
    const saved = saveSettings(settings);
    initPluginRegistry(saved);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '设置保存失败' };
  }
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: '选择下载目录' });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-plugins', async () => {
  return getRegisteredPlugins().map((p) => ({ name: p.name, displayName: p.displayName, supportedTypes: p.supportedTypes, configured: p.isConfigured() }));
});

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

app.whenReady().then(async () => {
  const settings = loadSettings();
  initPluginRegistry(settings);
  createWindow(settings);
  // Agent API：与 GUI 共用同一套插件与设置；端口被占用（如已独立运行）时静默跳过。
  try {
    const apiPort = Number(process.env.SUCAI_API_PORT) || DEFAULT_PORT;
    const server = createAgentApiServer({ getSettings: loadSettings });
    server.on('error', () => {}); // EADDRINUSE → 独立实例已在运行
    server.listen(apiPort, '127.0.0.1', () => {
      console.log(`[sucai-agent-api] listening on http://127.0.0.1:${apiPort}`);
    });
  } catch (_) {}
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow(loadSettings());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
