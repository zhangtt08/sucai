const { SourcePlugin } = require('./base');
const { downloadFile } = require('./utils');

const FIELDS = 'id,title,artist_title,image_id,date_display,medium_display,is_public_domain,thumbnail';

class ArticPlugin extends SourcePlugin {
  get name() { return 'artic'; }
  get displayName() { return '芝加哥艺术馆'; }
  get supportedTypes() { return ['image']; }

  isConfigured() { return true; }

  async search(query, mediaType, page = 1, perPage = 20) {
    if (mediaType === 'video') return [];
    const params = new URLSearchParams({
      q: query,
      limit: String(Math.min(perPage, 25)),
      page: String(page),
      fields: FIELDS,
    });
    const u = `https://api.artic.edu/api/v1/artworks/search?${params.toString()}`;
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36' } });
    if (!r.ok) throw new Error(`请求失败（HTTP ${r.status}）`);
    const d = await r.json();
    return (d.data || []).flatMap((a) => {
      if (!a.image_id) return [];
      return [{
        source: this.name, sourceId: String(a.id), mediaType: 'image',
        title: a.title || '未命名作品',
        description: [a.medium_display, a.date_display].filter(Boolean).join(' · '),
        author: a.artist_title || '佚名',
        authorUrl: a.artist_title ? `https://www.artic.edu/artists?search=${encodeURIComponent(a.artist_title)}` : '',
        thumbnailUrl: `https://www.artic.edu/iiif/2/${a.image_id}/full/400,/0/default.jpg`,
        previewUrl: `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg`,
        downloadUrl: `https://www.artic.edu/iiif/2/${a.image_id}/full/1686,/0/default.jpg`,
        width: 0, height: 0, fileSize: 0,
        tags: [],
        license: a.is_public_domain ? '公共领域（CC0）' : '芝加哥艺术馆授权展示',
      }];
    });
  }

  async download(item, destPath, onProgress) {
    return downloadFile(item.downloadUrl, destPath, onProgress);
  }
}

module.exports = { ArticPlugin };
