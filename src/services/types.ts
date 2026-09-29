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
  fileExtension?: string;
  width: number;
  height: number;
  duration?: number;
  fileSize: number;
  tags: string[];
  license: string;
}

export interface DownloadTask {
  id: string;
  item: AssetItem;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
  speed: string;
  filePath?: string;
  error?: string;
}

export interface PluginInfo {
  name: string;
  displayName: string;
  supportedTypes: string[];
  configured: boolean;
}

export interface AppSettings {
  apiKeys: { unsplash: string; pexels: string; pixabay: string; giphy: string; flickr: string };
  downloadDir: string;
  enabledSources: string[];
  theme: 'light' | 'dark';
}

export interface DownloadProgress {
  taskId: string;
  progress: { percent: number; speed: string };
}
