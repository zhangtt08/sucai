const { SourcePlugin } = require('./base');
const { downloadFile } = require('./utils');

const API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36' } });
  if (!r.ok) throw new Error(`请求失败（HTTP ${r.status}）`);
  return r.json();
}

class MetPlugin extends SourcePlugin {
  get name() { return 'met'; }
  get displayName() { return '大都会艺术馆'; }
  get supportedTypes() { return ['image']; }

  isConfigured() { return true; }

  async search(query, mediaType, page = 1, perPage = 20) {
    if (mediaType === 'video') return [];
    const params = new URLSearchParams({ q: query, hasImages: 'true', isPublicDomain: 'true' });
    const found = await fetchJson(`${API_BASE}/search?${params.toString()}`);
    const ids = found.objectIDs || [];
    const start = (page - 1) * perPage;
    const slice = ids.slice(start, start + perPage);

    const objects = await Promise.allSettled(
      slice.map((id) => fetchJson(`${API_BASE}/objects/${id}`)),
    );
    return objects.flatMap((result) => {
      if (result.status !== 'fulfilled') return [];
      const o = result.value;
      if (!o.primaryImage) return [];
      return [{
        source: this.name, sourceId: String(o.objectID), mediaType: 'image',
        title: o.title || '未命名藏品',
        description: [o.medium, o.objectDate].filter(Boolean).join(' · '),
        author: o.artistDisplayName || '佚名', authorUrl: o.artistWikidata_URL || '',
        thumbnailUrl: o.primaryImageSmall || o.primaryImage,
        previewUrl: o.primaryImageSmall || o.primaryImage,
        downloadUrl: o.primaryImage,
        width: 0, height: 0, fileSize: 0,
        tags: [o.department, o.culture].filter(Boolean),
        license: '大都会博物馆公共领域（Open Access）',
        fileExtension: o.primaryImage?.toLowerCase().endsWith('.png') ? '.png' : '.jpg',
      }];
    });
  }

  async download(item, destPath, onProgress) {
    return downloadFile(item.downloadUrl, destPath, onProgress);
  }
}

module.exports = { MetPlugin };
