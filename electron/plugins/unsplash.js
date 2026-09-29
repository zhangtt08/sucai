const { SourcePlugin } = require('./base');
const { downloadFile } = require('./utils');

class UnsplashPlugin extends SourcePlugin {
  get name() { return 'unsplash'; }
  get displayName() { return 'Unsplash'; }
  get supportedTypes() { return ['image']; }

  constructor(key) { super(); this.key = key || ''; }
  isConfigured() { return !!this.key; }

  async search(query, mediaType, page = 1, perPage = 20) {
    if (mediaType === 'video') return [];
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
    const resp = await fetch(url, { headers: { 'Authorization': `Client-ID ${this.key}` } });
    if (!resp.ok) throw new Error(`请求失败（HTTP ${resp.status}）`);
    const data = await resp.json();
    return (data.results || []).map((item) => ({
      source: this.name, sourceId: item.id, mediaType: 'image',
      title: item.alt_description || item.description || '未命名图片',
      description: item.description || '',
      author: item.user?.name || '', authorUrl: item.user?.links?.html || '',
      thumbnailUrl: item.urls?.thumb, previewUrl: item.urls?.regular,
      downloadUrl: item.urls?.raw || item.urls?.full,
      width: item.width || 0, height: item.height || 0, fileSize: 0,
      tags: (item.tags || []).map((t) => t.title), license: 'Unsplash License',
    }));
  }

  async download(item, destPath, onProgress) {
    await fetch(`https://api.unsplash.com/photos/${item.sourceId}/download`, {
      headers: { 'Authorization': `Client-ID ${this.key}` },
    });
    return downloadFile(item.downloadUrl || item.previewUrl, destPath, onProgress);
  }
}

module.exports = { UnsplashPlugin };
