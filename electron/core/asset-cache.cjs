// 素材索引缓存 —— 每次搜索（界面或 Agent）都会把结果写进来，
// 于是"按 id 取详情与直链"不必重新抓一遍全网，也不会凭空造数据。
'use strict';

const fs = require('fs');
const path = require('path');
const { resolveUserDataDir } = require('./settings-store.cjs');

const MAX_ENTRIES = 400;

function cacheFile() {
  return path.join(resolveUserDataDir(), 'asset-cache.json');
}

function keyOf(source, sourceId) {
  return `${source}_${sourceId}`;
}

function readCache() {
  try {
    const file = cacheFile();
    if (!fs.existsSync(file)) return {};
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch (_) {
    return {};
  }
}

function rememberAssets(items, { query = '', page = 0 } = {}) {
  if (!Array.isArray(items) || !items.length) return 0;
  const store = readCache();
  const now = new Date().toISOString();
  let added = 0;
  for (const item of items) {
    if (!item || !item.source || !item.sourceId) continue;
    const key = keyOf(item.source, item.sourceId);
    if (!store[key]) added += 1;
    store[key] = { item: trimItem(item), seenAt: now, query: String(query || '').slice(0, 80), page };
  }
  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    keys.sort((a, b) => String(store[a].seenAt).localeCompare(String(store[b].seenAt)))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((key) => { delete store[key]; });
  }
  try {
    const file = cacheFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(store), 'utf-8');
    fs.renameSync(temp, file);
  } catch (_) { return 0; }
  return added;
}

function trimItem(item) {
  const clone = { ...item };
  if (Array.isArray(clone.tags) && clone.tags.length > 20) {
    clone.tags = clone.tags.slice(0, 20);
    clone.tagsTruncated = true;
  }
  if (typeof clone.description === 'string' && clone.description.length > 500) {
    clone.description = `${clone.description.slice(0, 500)}…`;
  }
  return clone;
}

function findAsset(source, sourceId) {
  const store = readCache();
  const hit = store[keyOf(source, sourceId)];
  return hit ? { ...hit.item, _seenAt: hit.seenAt, _query: hit.query, _fromCache: true } : null;
}

function cachedSources() {
  const store = readCache();
  const counts = {};
  for (const entry of Object.values(store)) {
    const name = entry?.item?.source;
    if (name) counts[name] = (counts[name] || 0) + 1;
  }
  return counts;
}

module.exports = { rememberAssets, findAsset, cachedSources, cacheFile, MAX_ENTRIES };
