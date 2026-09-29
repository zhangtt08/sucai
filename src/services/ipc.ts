import type { AssetItem, AppSettings, PluginInfo, DownloadProgress } from './types';

interface ElectronAPI {
  search: (params: { query: string; mediaType: string; sources: string[]; page: number; perPage: number }) => Promise<{ success: boolean; data?: AssetItem[]; warnings?: string[]; error?: string }>;
  download: (item: AssetItem, destDir: string, taskId: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  onDownloadProgress: (callback: (data: DownloadProgress) => void) => () => void;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean; error?: string }>;
  selectDirectory: () => Promise<string | null>;
  getPlugins: () => Promise<PluginInfo[]>;
  openInFolder: (filePath: string) => Promise<void>;
}

declare global { interface Window { electron: ElectronAPI; } }

function api(): ElectronAPI | null {
  return typeof window !== 'undefined' && window.electron ? window.electron : null;
}

export async function searchAssets(query: string, mediaType: string, sources: string[], page = 1, perPage = 20): Promise<{ items: AssetItem[]; warnings: string[] }> {
  const a = api(); if (!a) throw new Error('当前页面未在桌面应用中运行');
  const r = await a.search({ query, mediaType, sources, page, perPage });
  if (!r.success) throw new Error(r.error || '搜索失败');
  return { items: r.data || [], warnings: r.warnings || [] };
}

export async function downloadAsset(item: AssetItem, destDir: string, taskId: string): Promise<string> {
  const a = api(); if (!a) throw new Error('当前页面未在桌面应用中运行');
  const r = await a.download(item, destDir, taskId);
  if (!r.success || !r.filePath) throw new Error(r.error || '下载失败');
  return r.filePath;
}

export function onDownloadProgress(cb: (data: DownloadProgress) => void): () => void {
  const a = api(); if (!a) return () => {};
  return a.onDownloadProgress(cb);
}

export async function getSettings(): Promise<AppSettings> { const a = api(); if (!a) throw new Error('当前页面未在桌面应用中运行'); return a.getSettings(); }
export async function saveSettings(s: AppSettings): Promise<void> {
  const a = api(); if (!a) throw new Error('当前页面未在桌面应用中运行');
  const result = await a.saveSettings(s);
  if (!result.success) throw new Error(result.error || '设置保存失败');
}
export async function getPlugins(): Promise<PluginInfo[]> { const a = api(); if (!a) return []; return a.getPlugins(); }
export async function selectDirectory(): Promise<string | null> { const a = api(); if (!a) return null; return a.selectDirectory(); }
export async function openInFolder(fp: string): Promise<void> { const a = api(); if (!a) return; await a.openInFolder(fp); }
