const { SourcePlugin } = require('./base');
const { downloadFile } = require('./utils');

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').trim();
}

// Wikimedia 会掐断通用程序 UA 的连接，需要浏览器 UA。
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

class WikimediaPlugin extends SourcePlugin {
  get name() { return 'wikimedia'; }
  get displayName() { return 'Wikimedia'; }
  get supportedTypes() { return ['image']; }

  isConfigured() { return true; }

  async search(query, mediaType, page = 1, perPage = 20) {
    if (mediaType === 'video') return [];
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `filetype:bitmap ${query}`,
      gsrnamespace: '6',
      gsroffset: String((page - 1) * perPage),
      gsrlimit: String(Math.min(perPage, 50)),
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: '600',
      format: 'json',
    });
    const u = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
    const r = await fetch(u, { headers: { 'User-Agent': BROWSER_UA } });
    if (!r.ok) throw new Error(`请求失败（HTTP ${r.status}）`);
    const d = await r.json();
    const pages = d?.query?.pages || {};
    return Object.values(pages)
      .sort((a, b) => (a.index || 0) - (b.index || 0))
      .map((pageItem) => {
        const info = pageItem.imageinfo?.[0] || {};
        const meta = info.extmetadata || {};
        return {
          source: this.name, sourceId: String(pageItem.pageid), mediaType: 'image',
          title: String(pageItem.title || '').replace(/^File:/, '') || '未命名图片',
          description: stripHtml(meta.ImageDescription?.value).slice(0, 300),
          author: stripHtml(meta.Artist?.value), authorUrl: '',
          thumbnailUrl: info.thumburl || info.url || '',
          previewUrl: info.thumburl || info.url || '',
          downloadUrl: info.url || '',
          width: info.width || 0, height: info.height || 0, fileSize: info.size || 0,
          tags: [],
          license: stripHtml(meta.LicenseShortName?.value) || 'Wikimedia Commons 授权',
          fileExtension: info.url ? `.${String(info.url).split('.').pop().toLowerCase()}` : undefined,
        };
      })
      .filter((item) => /\.(jpe?g|png|webp|gif)$/i.test(item.downloadUrl));
  }

  async download(item, destPath, onProgress) {
    return downloadFile(item.downloadUrl, destPath, onProgress);
  }
}

module.exports = { WikimediaPlugin };
