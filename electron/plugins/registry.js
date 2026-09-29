const { UnsplashPlugin } = require('./unsplash');
const { PexelsPlugin } = require('./pexels');
const { PixabayPlugin } = require('./pixabay');
const { MetPlugin } = require('./met');
const { ArticPlugin } = require('./artic');
const { WikimediaPlugin } = require('./wikimedia');const { GiphyPlugin } = require('./giphy');
const { FlickrPlugin } = require('./flickr');
const path = require('path');
const fs = require('fs');

const plugins = new Map();

function initPluginRegistry(settings) {
  plugins.clear();
  const keys = settings?.apiKeys || {};
  plugins.set('unsplash', new UnsplashPlugin(keys.unsplash));
  plugins.set('pexels', new PexelsPlugin(keys.pexels));
  plugins.set('pixabay', new PixabayPlugin(keys.pixabay));
  plugins.set('met', new MetPlugin());
  plugins.set('artic', new ArticPlugin());
  plugins.set('wikimedia', new WikimediaPlugin());
  plugins.set('giphy', new GiphyPlugin(keys.giphy));
  plugins.set('flickr', new FlickrPlugin(keys.flickr));
}

async function searchWithRetry(plugin, query, mediaType, page, perPage) {
  try {
    return await plugin.search(query, mediaType, page, perPage);
  } catch (firstError) {
    // 网络偶发超时很常见，失败后自动重试一次。
    if (firstError instanceof Error && /HTTP 4\d\d/.test(firstError.message)) throw firstError;
    return plugin.search(query, mediaType, page, perPage);
  }
}

async function searchAll(query, mediaType, sources, page, perPage) {
  const configured = Array.from(plugins.values()).filter((plugin) => plugin.isConfigured());
  const enabled = (sources && sources.length > 0)
    ? sources.map((name) => plugins.get(name)).filter((plugin) => plugin?.isConfigured())
    : configured;
  if (enabled.length === 0) throw new Error('请先在设置中配置并选择至少一个素材平台');

  const settled = await Promise.allSettled(
    enabled.map((plugin) => searchWithRetry(plugin, query, mediaType, page, perPage)),
  );
  const results = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const failures = settled.flatMap((result, index) =>
    result.status === 'rejected'
      ? [`${enabled[index].displayName}: ${result.reason instanceof Error ? result.reason.message : '请求失败'}`]
      : [],
  );
  if (results.length === 0 && failures.length > 0) {
    throw new Error(failures.join('；'));
  }
  return { results, warnings: failures };
}

function getExtension(item) {
  if (/^\.(?:jpe?g|png|webp|avif|gif)$/i.test(item.fileExtension || '')) {
    return item.fileExtension.toLowerCase().replace('.jpeg', '.jpg');
  }
  if (item.mediaType === 'video') return '.mp4';
  try {
    const match = new URL(item.downloadUrl).pathname.match(/\.(jpe?g|png|webp|gif)$/i);
    if (match) return `.${match[1].toLowerCase().replace('jpeg', 'jpg')}`;
  } catch (_) {}
  return '.jpg';
}

function uniquePath(filePath) {
  if (!fs.existsSync(filePath)) return filePath;
  const parsed = path.parse(filePath);
  let index = 1;
  let candidate;
  do {
    candidate = path.join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`);
    index += 1;
  } while (fs.existsSync(candidate));
  return candidate;
}

async function downloadAsset(item, destDir, onProgress) {
  const p = plugins.get(item.source);
  if (!p?.isConfigured()) throw new Error(`平台 ${item.source} 未配置`);
  const ext = getExtension(item);
  const safe = (item.title || 'untitled')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/[. ]+$/g, '')
    .substring(0, 80) || 'untitled';
  const destPath = uniquePath(path.join(destDir, `${item.source}_${item.sourceId}_${safe}${ext}`));
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  return p.download(item, destPath, onProgress);
}

function getRegisteredPlugins() { return Array.from(plugins.values()); }

module.exports = { initPluginRegistry, searchAll, downloadAsset, getRegisteredPlugins };
