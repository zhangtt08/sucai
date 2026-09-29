const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const FILE = path.join(app.getPath('userData'), 'settings.json');

const DEFAULTS = {
  apiKeys: { unsplash: '', pexels: '', pixabay: '', giphy: '', flickr: '' },
  downloadDir: path.join(app.getPath('downloads'), 'MediaDownloader'),
  enabledSources: ['unsplash', 'pexels', 'pixabay', 'met', 'artic'],
  theme: 'light',
};

function loadSettings() {
  try {
    if (fs.existsSync(FILE)) {
      const stored = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
      return {
        ...DEFAULTS,
        ...stored,
        apiKeys: { ...DEFAULTS.apiKeys, ...(stored.apiKeys || {}) },
      };
    }
  } catch (_) {}
  return { ...DEFAULTS, apiKeys: { ...DEFAULTS.apiKeys } };
}

function saveSettings(settings) {
  const sanitized = {
    ...DEFAULTS,
    ...settings,
    apiKeys: {
      unsplash: String(settings?.apiKeys?.unsplash || '').trim(),
      pexels: String(settings?.apiKeys?.pexels || '').trim(),
      pixabay: String(settings?.apiKeys?.pixabay || '').trim(),
      giphy: String(settings?.apiKeys?.giphy || '').trim(),
      flickr: String(settings?.apiKeys?.flickr || '').trim(),
    },
    downloadDir: String(settings?.downloadDir || DEFAULTS.downloadDir),
    theme: settings?.theme === 'dark' ? 'dark' : 'light',
  };
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tempFile = `${FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(sanitized, null, 2), 'utf-8');
  fs.renameSync(tempFile, FILE);
  return sanitized;
}

module.exports = { loadSettings, saveSettings };
