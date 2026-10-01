import type { AppSettings, AssetItem, PluginInfo, SearchResponse, SourceGroup, SourceProbe, DownloadReceipt } from './types';

export interface SearchSourceEvent {
  requestId: string;
  group: SourceGroup;
  items: AssetItem[];
}

export type DownloadEvent =
  | { batchId: string; type: 'started'; taskId: string; source: string; title: string }
  | { batchId: string; type: 'progress'; taskId: string; progress: { percent: number; speed: string } }
  | { batchId: string; type: 'completed'; taskId: string; receipt: DownloadReceipt }
  | { batchId: string; type: 'failed'; taskId: string; error: string; kind?: string; hint?: string }
  | { batchId: string; type: 'cancelled'; taskId: string }
  | { batchId: string; type: 'paused' | 'resumed' | 'cancelled_all' }
  | { batchId: string; type: 'batch-done'; result: unknown };

interface ElectronAPI {
  search: (params: { requestId: string; query: string; mediaType: string; sources: string[]; page: number; perPage: number; dedupe?: boolean }) => Promise<Partial<SearchResponse> & { success: boolean; error?: string }>;
  onSearchSource: (callback: (event: SearchSourceEvent) => void) => () => void;
  probeSource: (name: string) => Promise<{ success: boolean; data?: SourceProbe; error?: string }>;
  assetDetail: (source: string, sourceId: string) => Promise<{ success: boolean; data?: AssetItem; live?: boolean; error?: string }>;
  downloadStart: (items: AssetItem[], destDir: string, query: string) => Promise<{
    success: boolean;
    batchId?: string;
    size?: number;
    jobs?: { taskId: string; source: string; sourceId: string; title: string; thumbnailUrl: string }[];
    error?: string;
  }>;
  downloadPause: (batchId: string) => Promise<{ success: boolean; paused?: boolean; error?: string }>;
  downloadResume: (batchId: string) => Promise<{ success: boolean; paused?: boolean; error?: string }>;
  downloadCancel: (batchId: string) => Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
  onDownloadEvent: (callback: (event: DownloadEvent) => void) => () => void;
  downloadLog: (params: { limit?: number; source?: string; query?: string }) => Promise<{
    success: boolean;
    entries?: DownloadReceipt[];
    totalLogged?: number;
    totalMatching?: number;
    truncated?: boolean;
    file?: string;
    error?: string;
  }>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean; data?: AppSettings; error?: string }>;
  selectDirectory: () => Promise<string | null>;
  getPlugins: () => Promise<PluginInfo[]>;
  openInFolder: (filePath: string) => Promise<void>;
  windowControls: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<boolean>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
  };
}

declare global { interface Window { electron: ElectronAPI; } }

export const inDesktop = (): boolean => typeof window !== 'undefined' && !!window.electron;

function api(): ElectronAPI {
  if (!inDesktop()) throw new Error('当前页面未在桌面应用中运行（请用 npm run electron:dev 启动）');
  return window.electron;
}

export async function searchAssets(params: { requestId: string; query: string; mediaType: string; sources: string[]; page: number; perPage: number; dedupe?: boolean }): Promise<SearchResponse> {
  const result = await api().search(params);
  if (!result.success) throw new Error(result.error || '搜索失败');
  return {
    items: result.items || [],
    groups: (result.groups || []) as SearchResponse['groups'],
    warnings: result.warnings || [],
    deduped: result.deduped || 0,
    allFailed: !!result.allFailed,
    noSources: result.noSources,
    totalMs: result.totalMs || 0,
    query: result.query || params.query,
    page: result.page || params.page,
    perPage: result.perPage || params.perPage,
  };
}

export const onSearchSource = (cb: (event: SearchSourceEvent) => void) => (inDesktop() ? api().onSearchSource(cb) : () => {});
export const probeSource = async (name: string): Promise<SourceProbe> => {
  const result = await api().probeSource(name);
  if (!result.success || !result.data) throw new Error(result.error || '探测失败');
  return result.data;
};
export const assetDetail = async (source: string, sourceId: string): Promise<AssetItem> => {
  const result = await api().assetDetail(source, sourceId);
  if (!result.success || !result.data) throw new Error(result.error || '获取详情失败');
  return result.data;
};

export const startBatch = async (items: AssetItem[], destDir: string, query: string) => {
  const result = await api().downloadStart(items, destDir, query);
  if (!result.success || !result.batchId) throw new Error(result.error || '无法开始下载');
  return { batchId: result.batchId, jobs: result.jobs || [] };
};
export const onDownloadEvent = (cb: (event: DownloadEvent) => void) => (inDesktop() ? api().onDownloadEvent(cb) : () => {});
export const downloadLog = async (params: { limit?: number; source?: string; query?: string } = {}) => api().downloadLog(params);
export const batchPause = (batchId: string) => api().downloadPause(batchId);
export const batchResume = (batchId: string) => api().downloadResume(batchId);
export const batchCancel = (batchId: string) => api().downloadCancel(batchId);

export async function getSettings(): Promise<AppSettings> { return api().getSettings(); }
export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const result = await api().saveSettings(settings);
  if (!result.success) throw new Error(result.error || '设置保存失败');
  return result.data || settings;
}
export async function getPlugins(): Promise<PluginInfo[]> { return inDesktop() ? api().getPlugins() : []; }
export async function selectDirectory(): Promise<string | null> { return inDesktop() ? api().selectDirectory() : null; }
export async function openInFolder(filePath: string): Promise<void> { if (inDesktop()) await api().openInFolder(filePath); }
