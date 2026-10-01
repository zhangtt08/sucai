// 素材下载器 Agent API — 本地 HTTP 服务，供外部 agent 以 tool 形式调用。
// 两种用法：
//   1. 独立运行（无 GUI）：node electron/agent-api.cjs   ← 复用 GUI 已保存的 %APPDATA%/sucai/settings.json
//   2. 随桌面应用启动：main.cjs 在 app ready 时调用 startAgentApi({ settings })
// 端口：环境变量 SUCAI_API_PORT，默认 8391。仅监听 127.0.0.1。
'use strict';

const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { initPluginRegistry, searchAll, downloadAsset, getRegisteredPlugins } = require('./plugins/registry');

const VERSION = '1.0.0';
const DEFAULT_PORT = 8391;

// 与 Electron app.getPath('userData') 等价的路径（app name = sucai）
function standaloneSettingsPath() {
  return path.join(os.homedir(), 'AppData', 'Roaming', 'sucai', 'settings.json');
}

function loadStandaloneSettings() {
  const file = standaloneSettingsPath();
  const defaults = {
    apiKeys: { unsplash: '', pexels: '', pixabay: '', giphy: '', flickr: '' },
    downloadDir: path.join(os.homedir(), 'Downloads', 'MediaDownloader'),
    enabledSources: ['unsplash', 'pexels', 'pixabay', 'met', 'artic'],
  };
  try {
    if (fs.existsSync(file)) {
      const stored = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return { ...defaults, ...stored, apiKeys: { ...defaults.apiKeys, ...(stored.apiKeys || {}) } };
    }
  } catch (_) {}
  return defaults;
}

function sourcesView() {
  return getRegisteredPlugins().map((p) => ({
    name: p.name,
    displayName: p.displayName,
    supportedTypes: p.supportedTypes,
    configured: p.isConfigured(),
  }));
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch (_) {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function createAgentApiServer({ getSettings } = {}) {
  const settingsOf = typeof getSettings === 'function' ? getSettings : loadStandaloneSettings;

  async function handle(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1');
    const route = `${req.method} ${url.pathname}`;

    if (route === 'GET /health') {
      return send(res, 200, { ok: true, tool: 'sucai', version: VERSION, port: url.port });
    }
    if (route === 'GET /api/sources') {
      return send(res, 200, { ok: true, data: sourcesView() });
    }
    if (route === 'POST /api/search') {
      let body;
      try { body = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: e.message }); }
      try {
        const query = String(body.query || '').trim().slice(0, 200);
        if (!query) return send(res, 400, { ok: false, error: 'query 不能为空' });
        const mediaType = ['image', 'video', 'all'].includes(body.mediaType) ? body.mediaType : 'image';
        const sources = Array.isArray(body.sources) ? body.sources.map(String).slice(0, 10) : [];
        const page = Math.max(1, Math.min(Number(body.page) || 1, 100));
        const perPage = Math.max(3, Math.min(Number(body.perPage) || 24, 80));
        const { results, warnings } = await searchAll(query, mediaType, sources, page, perPage);
        return send(res, 200, { ok: true, data: results, warnings, count: results.length });
      } catch (err) {
        return send(res, 502, { ok: false, error: err instanceof Error ? err.message : '搜索失败' });
      }
    }
    if (route === 'POST /api/download') {
      let body;
      try { body = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: e.message }); }
      try {
        const item = body.item;
        if (!item?.source || !item?.sourceId || !item?.downloadUrl) throw new Error('item 缺少 source/sourceId/downloadUrl');
        const settings = settingsOf();
        const destDir = (typeof body.destDir === 'string' && body.destDir.trim()) ? body.destDir.trim() : settings.downloadDir;
        const filePath = await downloadAsset(item, destDir, () => {});
        return send(res, 200, { ok: true, data: { filePath } });
      } catch (err) {
        return send(res, 502, { ok: false, error: err instanceof Error ? err.message : '下载失败' });
      }
    }
    return send(res, 404, { ok: false, error: `未知路由 ${route}，可用：GET /health、GET /api/sources、POST /api/search、POST /api/download` });
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((err) => send(res, 500, { ok: false, error: err instanceof Error ? err.message : '内部错误' }));
  });
}

// 独立入口（node electron/agent-api.cjs）
if (require.main === module) {
  const settings = loadStandaloneSettings();
  initPluginRegistry(settings);
  const port = Number(process.env.SUCAI_API_PORT) || DEFAULT_PORT;
  const server = createAgentApiServer();
  server.on('error', (err) => {
    console.error(`[sucai-agent-api] 启动失败: ${err.message}`);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`[sucai-agent-api] listening on http://127.0.0.1:${port} (sources: ${sourcesView().filter((s) => s.configured).map((s) => s.name).join(', ') || 'none configured'})`);
  });
}

module.exports = { createAgentApiServer, loadStandaloneSettings, VERSION, DEFAULT_PORT };
