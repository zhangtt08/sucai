// 主进程侧的设置入口：只提供 Electron 的 userData 位置，读写逻辑全在
// core/settings-store.cjs（Agent 无界面时读同一份，不会再有两套默认值）。
const { app } = require('electron');
const store = require('./core/settings-store.cjs');

function userDataDir() {
  return app.getPath('userData');
}

function settingsFilePath() {
  return require('path').join(userDataDir(), 'settings.json');
}

function loadSettings() {
  return store.loadSettings(settingsFilePath());
}

function saveSettings(settings) {
  return store.saveSettings(settings, settingsFilePath());
}

module.exports = { loadSettings, saveSettings, settingsFilePath, DEFAULTS: store.DEFAULTS, SOURCE_DEFS: store.SOURCE_DEFS };
