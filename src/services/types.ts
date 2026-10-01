export type MediaType = 'image' | 'video' | 'all';

export interface AssetItem {
  source: string;
  sourceDisplayName?: string;
  sourceId: string;
  mediaType: 'image' | 'video';
  title: string;
  description: string;
  author: string;
  authorUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  downloadUrl: string;
  pageUrl?: string;
  fileExtension?: string;
  width: number;
  height: number;
  duration?: number;
  fileSize: number;
  tags: string[];
  license: string;
}

export type ErrorFix = 'settings' | 'wait' | 'retry' | 'network' | 'switch_source' | 'upgrade' | '';

export interface ClassifiedError {
  kind: string;
  label: string;
  message: string;
  hint: string;
  fix: ErrorFix;
  retryable?: boolean;
  status?: number;
  source?: string;
}

export type SourceStatus = 'searching' | 'ok' | 'empty' | 'failed' | 'unsupported';

export interface SourceGroup {
  name: string;
  displayName: string;
  status: SourceStatus;
  count: number;
  rawCount?: number;
  ms: number;
  error: ClassifiedError | null;
  needsKey: boolean;
  supportedTypes: string[];
}

export type TaskStatus = 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';

export interface DownloadTask {
  id: string;
  batchId: string;
  item: AssetItem;
  status: TaskStatus;
  progress: number;
  speed: string;
  filePath?: string;
  fileName?: string;
  bytes?: number;
  error?: string;
}

export interface DownloadReceipt {
  filePath: string;
  fileName: string;
  bytes: number;
  source: string;
  sourceId: string;
  title: string;
  license: string;
  ms: number;
  at?: string;
  exists?: boolean;
}

export interface PluginInfo {
  name: string;
  displayName: string;
  supportedTypes: string[];
  configured: boolean;
  needsKey: boolean;
  keyHint: string;
  keyUrl: string;
  note: string;
  supportsById: boolean;
}

export interface SourceProbe {
  name: string;
  displayName: string;
  status: 'ok' | 'empty' | 'failed' | 'needs_key' | 'unknown';
  configured: boolean;
  count: number;
  ms: number;
  error: ClassifiedError | null;
  sample: { id: string; title: string; thumbnailUrl: string }[];
}

export interface AppSettings {
  apiKeys: { unsplash: string; pexels: string; pixabay: string; giphy: string; flickr: string };
  downloadDir: string;
  enabledSources: string[];
  theme: 'light' | 'dark';
  maxConcurrentDownloads: number;
  filenameTemplate: string;
  subfolderTemplate: string;
  dedupe: boolean;
}

export interface SearchResponse {
  items: AssetItem[];
  groups: SourceGroup[];
  warnings: string[];
  deduped: number;
  allFailed: boolean;
  noSources?: boolean;
  totalMs: number;
  query: string;
  page: number;
  perPage: number;
}
