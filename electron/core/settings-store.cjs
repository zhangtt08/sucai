// 设置与来源目录 —— 纯 Node 模块，不依赖 electron。
// electron/settings.js（主进程）与 agent/tools.mjs（无界面）都读这一份，
// 避免"两套默认值、两条路径"的漂移。
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// 每个素材源的元信息：界面、Agent 工具、设置面板共用一份，不再各写各的。
const SOURCE_DEFS = [
  {
    name: 'unsplash', displayName: 'Unsplash', types: ['image'], needsKey: true,
    keyHint: 'Access Key', keyUrl: 'https://unsplash.com/developers',
    note: '高质量摄影图，免费商用（Unsplash License）。',
  },
  {
    name: 'pexels', displayName: 'Pexels', types: ['image', 'video'], needsKey: true,
    keyHint: 'API Key', keyUrl: 'https://www.pexels.com/api/',
    note: '图片与视频都有，是唯一的两个视频来源之一。',
  },
  {
    name: 'pixabay', displayName: 'Pixabay', types: ['image', 'video'], needsKey: true,
    keyHint: 'API Key', keyUrl: 'https://pixabay.com/api/docs/',
    note: '图片与视频；免费额度按小时限制，超限会返回 429。',
  },
  {
    name: 'giphy', displayName: 'Giphy', types: ['image'], needsKey: true,
    keyHint: 'API Key (public beta)', keyUrl: 'https://developers.giphy.com/',
    note: 'GIF 动图；下载会得到 .gif 文件。',
  },
  {
    name: 'flickr', displayName: 'Flickr', types: ['image'], needsKey: true,
    keyHint: 'API Key', keyUrl: 'https://www.flickr.com/services/apps/create/',
    note: '授权五花八门（CC BY / CC0 / 保留所有权利），下载前看清许可字段。',
  },
  {
    name: 'met', displayName: '大都会艺术馆', types: ['image'], needsKey: false,
    note: '公共领域藏品（Open Access）。逐条取详情，响应偏慢。',
  },
  {
    name: 'artic', displayName: '芝加哥艺术馆', types: ['image'], needsKey: false,
    note: '公共领域藏品，IIIF 直链，响应快。',
  },
  {
    name: 'wikimedia', displayName: 'Wikimedia', types: ['image'], needsKey: false,
    note: '维基共享资源图片；授权逐文件不同，多为 CC 系列。',
  },
];

const SOURCE_BY_NAME = new Map(SOURCE_DEFS.map((def) => [def.name, def]));
const KEY_NAMES = SOURCE_DEFS.filter((def) => def.needsKey).map((def) => def.name);

function defaultDownloadDir() {
  return path.join(os.homedir(), 'Downloads', 'MediaDownloader');
}

const DEFAULTS = {
  apiKeys: { unsplash: '', pexels: '', pixabay: '', giphy: '', flickr: '' },
  downloadDir: defaultDownloadDir(),
  enabledSources: SOURCE_DEFS.filter((def) => !def.needsKey).map((def) => def.name),
  theme: 'light',
  maxConcurrentDownloads: 2,
  filenameTemplate: '{source}_{id}_{title}',
  subfolderTemplate: '',
  dedupe: true,
};

// Electron 的 userData 目录（app name 取 package.json 的 name），
// 打包后 productName 参与命名，所以两个候选都试；env 可强制指定。
function userDataCandidates() {
  const appData = process.env.APPDATA
    || (process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : path.join(os.homedir(), '.config'));
  return [
    process.env.SUCAI_USER_DATA,
    path.join(appData, 'sucai'),
    path.join(appData, '素材下载器'),
  ].filter(Boolean);
}

function resolveUserDataDir() {
  const candidates = userDataCandidates();
  const withSettings = candidates.find((dir) => fs.existsSync(path.join(dir, 'settings.json')));
  return withSettings || candidates[0];
}

function settingsFile() {
  return path.join(resolveUserDataDir(), 'settings.json');
}

function sanitizeSettings(raw) {
  const apiKeys = {};
  for (const name of KEY_NAMES) apiKeys[name] = String(raw?.apiKeys?.[name] ?? DEFAULTS.apiKeys[name] ?? '').trim();
  const clamp = (value, min, max, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  };
  const allowedSources = SOURCE_DEFS.map((def) => def.name);
  const enabled = Array.isArray(raw?.enabledSources)
    ? raw.enabledSources.map(String).filter((name) => allowedSources.includes(name))
    : [...DEFAULTS.enabledSources];
  const template = String(raw?.filenameTemplate ?? DEFAULTS.filenameTemplate).trim() || DEFAULTS.filenameTemplate;
  return {
    apiKeys,
    downloadDir: String(raw?.downloadDir || DEFAULTS.downloadDir),
    enabledSources: enabled.length ? enabled : [...DEFAULTS.enabledSources],
    theme: raw?.theme === 'dark' ? 'dark' : 'light',
    maxConcurrentDownloads: clamp(raw?.maxConcurrentDownloads, 1, 4, DEFAULTS.maxConcurrentDownloads),
    filenameTemplate: template.slice(0, 80),
    subfolderTemplate: String(raw?.subfolderTemplate ?? DEFAULTS.subfolderTemplate).slice(0, 60),
    dedupe: raw?.dedupe !== false,
  };
}

function loadSettings(file = settingsFile()) {
  try {
    if (fs.existsSync(file)) return sanitizeSettings(JSON.parse(fs.readFileSync(file, 'utf-8')));
  } catch (_) { /* 损坏的设置不阻塞启动，回落默认值 */ }
  return sanitizeSettings({});
}

function saveSettings(settings, file = settingsFile()) {
  const sanitized = sanitizeSettings({ ...readRaw(file), ...settings });
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(sanitized, null, 2), 'utf-8');
  fs.renameSync(tempFile, file);
  return sanitized;
}

function readRaw(file) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (_) {}
  return {};
}

// 界面/Agent 都需要"永不出现在响应里的密钥"这一层保护。
function redactSecrets(settings) {
  const apiKeys = {};
  for (const name of KEY_NAMES) {
    const value = settings?.apiKeys?.[name];
    apiKeys[name] = value ? { configured: true, length: value.length } : { configured: false, length: 0 };
  }
  const { apiKeys: _omit, ...rest } = settings || {};
  return { ...rest, apiKeys };
}

module.exports = {
  DEFAULTS,
  SOURCE_DEFS,
  SOURCE_BY_NAME,
  KEY_NAMES,
  loadSettings,
  saveSettings,
  sanitizeSettings,
  settingsFile,
  resolveUserDataDir,
  redactSecrets,
};
