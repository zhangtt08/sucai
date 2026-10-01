// 下载的唯一实现 —— 界面队列、快速下载、Agent 批量下载都走这里。
// 覆盖：URL 有效性校验、文件名/子目录模板、并发上限、暂停/继续/取消、真实落盘回执与历史。
'use strict';

const fs = require('fs');
const path = require('path');
const { getPlugin } = require('../plugins/registry');
const { headersFor: browserHeaders } = require('../plugins/utils.js');
const { classifyError } = require('./errors.cjs');
const { loadSettings, resolveUserDataDir } = require('./settings-store.cjs');

const LOG_LIMIT = 300;
const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/g;

function sanitizeSegment(value, max = 80) {
  const cleaned = String(value || '')
    .replace(ILLEGAL, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[. ]+|[, .]+$/g, '')
    .slice(0, max);
  return cleaned;
}

// 平台标题常常自带扩展名（Wikimedia 的 "Cat November 2010-1a.jpg"），
// 再拼上真实扩展名就得到 .jpg.jpg —— 命名模板里先剥掉。
function stripTrailingExtension(value) {
  return String(value || '').replace(/\.(jpe?g|png|webp|gif|avif|tiff?|mp4|mov|webm)$/i, '');
}

// ---- URL 校验 ---------------------------------------------------------------

function validateDownloadUrl(rawUrl, { allowHttp = true } = {}) {
  const urlText = String(rawUrl || '').trim();
  if (!urlText) throw new Error('下载地址为空：这条素材没有可直链的原始文件，请改用预览地址或换一条素材');
  let parsed;
  try {
    parsed = new URL(urlText);
  } catch (_) {
    throw new Error(`下载地址无法解析：${urlText.slice(0, 80)}`);
  }
  if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
    throw new Error(`仅支持 HTTP/HTTPS 直链，收到的是 ${parsed.protocol}`);
  }
  if (!parsed.hostname || !/\./.test(parsed.hostname)) {
    throw new Error(`下载地址域名无效：${parsed.hostname || '(空)'}`);
  }
  return parsed;
}

// 真实探活：HEAD 优先（省流量），平台多半不支持 HEAD，退化成 Range GET 首块。
async function probeUrl(rawUrl, timeoutMs = 12_000) {
  const url = validateDownloadUrl(rawUrl);
  const started = Date.now();
  const attempt = async (method, headers) => {
    const response = await fetch(url, {
      method,
      headers: { ...browserHeaders(url), ...headers },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response;
  };
  try {
    let response = await attempt('HEAD', {});
    let bytes = readBytes(response);
    let contentType = response.headers.get('content-type') || '';
    // 不少图床（Pexels CDN 实测如此）对 HEAD 回 200 却不带 Content-Length / Content-Type，
    // 这时必须再用 Range GET 量一次，否则"探活成功"只给回一个 0 字节的没用事实。
    if (!response.ok || !bytes || !contentType) {
      const ranged = await attempt('GET', { Range: 'bytes=0-0' });
      if (ranged.ok) response = ranged;
      bytes = readBytes(ranged) || bytes;
      if (!contentType) contentType = ranged.headers.get('content-type') || '';
    }
    // HTTP 200 但内容是 HTML = 被风控/登录页拦下，不是可用的素材直链。
    const html = /text\/html|application\/xml/i.test(contentType);
    return {
      ok: response.ok && !html,
      status: response.status,
      bytes: html ? 0 : bytes || 0,
      contentType,
      blockedByPlatform: html,
      finalHost: safeHost(response.url || url.toString()),
      ms: Date.now() - started,
      hint: html ? '平台返回的是网页而不是素材文件：直链多半已过期或被风控，请重新搜索该素材。' : undefined,
    };
  } catch (error) {
    const classified = classifyError(error);
    return { ok: false, status: 0, bytes: 0, contentType: '', error: classified.message, hint: classified.hint, ms: Date.now() - started };
  }
}

// Headers 只能用 .get()：`response.headers['content-length']` 恒为 undefined。
function readBytes(response) {
  const range = String(response.headers.get('content-range') || '');
  const total = range.match(/\/(\d+)\s*$/);
  if (total) return Number(total[1]) || 0;
  return Number(response.headers.get('content-length') || 0) || 0;
}

function safeHost(value) {
  try { return new URL(value).host; } catch (_) { return ''; }
}

// ---- 命名与目录 -------------------------------------------------------------

const DEFAULT_TEMPLATE = '{source}_{id}_{title}';

function applyTemplate(template, values) {
  const text = String(template || DEFAULT_TEMPLATE);
  return text.replace(/\{(\w+)\}/g, (match, token) => {
    const key = token.toLowerCase();
    if (key === 'source') return values.source || '';
    if (key === 'id' || key === 'sourceid') return values.id || '';
    if (key === 'title') return values.title || '';
    if (key === 'query' || key === 'q') return values.query || '';
    if (key === 'date') return values.date || '';
    if (key === 'author') return values.author || '';
    if (key === 'index' || key === 'n') return String(values.index ?? '');
    if (key === 'type') return values.mediaType || '';
    return '';
  });
}

function dateStamp(at = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}`;
}

function extensionFor(item) {
  if (/^\.(jpe?g|png|webp|avif|gif|tiff?|mp4|mov|webm)$/i.test(item.fileExtension || '')) {
    return item.fileExtension.toLowerCase().replace('.jpeg', '.jpg').replace('.tiff', '.tif');
  }
  if (item.mediaType === 'video') return '.mp4';
  try {
    const match = new URL(item.downloadUrl).pathname.match(/\.(jpe?g|png|webp|gif|avif|tiff?|mp4|mov|webm)$/i);
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

function ensureDir(dir) {
  const target = String(dir || '').trim();
  if (!target) throw new Error('未设置下载目录：到「设置 → 下载位置」选一个文件夹');
  if (!path.isAbsolute(target)) throw new Error(`下载目录必须是绝对路径：${target}`);
  try {
    fs.mkdirSync(target, { recursive: true });
    fs.accessSync(target, fs.constants.W_OK);
  } catch (error) {
    throw new Error(`下载目录不可写：${target}（${error.code || error.message}）`);
  }
  return target;
}

function resolveTarget(item, destDir, { settings = {}, query = '', index = 0 } = {}) {
  const now = new Date();
  const values = {
    source: sanitizeSegment(item.source, 24),
    id: sanitizeSegment(item.sourceId, 40),
    title: sanitizeSegment(stripTrailingExtension(item.title) || 'untitled', 60),
    query: sanitizeSegment(query, 40),
    author: sanitizeSegment(item.author, 40),
    date: dateStamp(now),
    index: index + 1,
    mediaType: item.mediaType || 'image',
  };
  // 子目录模板里的 "/" 是分层分隔符，必须逐段清洗后再拼接
  // （先整体清洗会把 "/" 当非法字符删掉，实测得到 "test-batchartic" 这种粘连目录名）。
  const sub = applyTemplate(settings.subfolderTemplate, values)
    .split(/[\\/]+/)
    .map((segment) => sanitizeSegment(segment, 60))
    .filter(Boolean)
    .join(path.sep);
  const base = sanitizeSegment(applyTemplate(settings.filenameTemplate || DEFAULT_TEMPLATE, values), 120) || `${values.source}_${values.id}`;
  const dir = ensureDir(sub ? path.join(destDir, sub) : destDir);
  const ext = extensionFor(item);
  return uniquePath(path.join(dir, `${base}${ext}`));
}

// ---- 单个下载 ---------------------------------------------------------------

async function downloadItem(item, { destDir, settings, query, index, onProgress, record = true } = {}) {
  if (!item || !item.source || !item.sourceId) throw new Error('素材信息不完整：缺少 source / sourceId');
  const conf = settings || loadSettings();
  const plugin = getPlugin(item.source);
  if (!plugin) throw new Error(`未知素材源：${item.source}`);
  if (!plugin.isConfigured()) throw new Error(`${plugin.displayName} 尚未配置 API Key，无法下载`);
  const url = validateDownloadUrl(item.downloadUrl || item.previewUrl);
  item = { ...item, downloadUrl: url.toString() };

  const target = resolveTarget(item, destDir || conf.downloadDir, { settings: conf, query, index });
  const started = Date.now();
  await plugin.download(item, target, onProgress);
  const bytes = fs.existsSync(target) ? fs.statSync(target).size : 0;
  if (!bytes) {
    try { fs.rmSync(target, { force: true }); } catch (_) {}
    throw new Error('下载结束但文件为空，已丢弃');
  }
  const receipt = {
    source: item.source,
    sourceId: String(item.sourceId),
    title: String(item.title || '').slice(0, 120),
    mediaType: item.mediaType || 'image',
    filePath: target,
    fileName: path.basename(target),
    bytes,
    license: item.license || '',
    url: item.downloadUrl,
    query: String(query || '').slice(0, 80),
    at: new Date().toISOString(),
    ms: Date.now() - started,
  };
  if (record) recordDownload(receipt, conf);
  return receipt;
}

// ---- 下载历史 ---------------------------------------------------------------

function logFile() {
  return path.join(resolveUserDataDir(), 'downloads.json');
}

function readDownloadLog({ limit = 50, source = '', query = '' } = {}) {
  let entries = [];
  try {
    const file = logFile();
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (Array.isArray(parsed)) entries = parsed;
    }
  } catch (_) { return { entries: [], file: logFile(), error: '历史文件损坏，已按空处理' }; }
  const filtered = entries.filter((entry) => {
    if (source && entry.source !== source) return false;
    if (query && !`${entry.query || ''} ${entry.title || ''}`.toLowerCase().includes(String(query).toLowerCase())) return false;
    return true;
  });
  const capped = Math.max(1, Math.min(Number(limit) || 50, LOG_LIMIT));
  const slice = filtered.slice(-capped).reverse();
  return {
    entries: slice.map((entry) => ({ ...entry, exists: fs.existsSync(entry.filePath || '') })),
    totalMatching: filtered.length,
    totalLogged: entries.length,
    truncated: filtered.length > slice.length,
    file: logFile(),
  };
}

function recordDownload(receipt, settings) {
  const file = logFile();
  try {
    let entries = [];
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (Array.isArray(parsed)) entries = parsed;
    }
    entries.push(receipt);
    if (entries.length > LOG_LIMIT) entries = entries.slice(-LOG_LIMIT);
    const dir = path.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(entries, null, 2), 'utf-8');
    fs.renameSync(temp, file);
    return true;
  } catch (_) {
    return false; // 历史写失败不能算下载失败 —— 文件已经在盘上了
  }
}

// ---- 队列：并发上限 + 暂停/继续/取消 ---------------------------------------
// onEvent({ type, taskId, ...}) —— 界面据此渲染，Agent 只用 done 回执。
function createDownloadQueue(items, { destDir, settings, query, concurrency, onEvent = () => {} } = {}) {
  const conf = settings || loadSettings();
  const queue = items.map((item, position) => ({ item, position, taskId: `${item.source}_${item.sourceId}_${Date.now()}_${position}` }));
  const limit = Math.max(1, Math.min(Number(concurrency || conf.maxConcurrentDownloads || 2), 4));
  let cursor = 0;
  let paused = false;
  let cancelled = false;
  let active = 0;
  let settledResolve;
  const results = [];

  const finished = new Promise((resolve) => { settledResolve = resolve; });
  const settled = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const maybeSettle = () => {
    if (results.length >= queue.length) settledResolve(controller);
  };

  const runOne = async (job) => {
    active += 1;
    onEvent({ type: 'started', taskId: job.taskId, source: job.item.source, title: job.item.title });
    try {
      const receipt = await downloadItem(job.item, {
        destDir,
        settings: conf,
        query,
        index: job.position,
        onProgress: (progress) => onEvent({ type: 'progress', taskId: job.taskId, progress }),
      });
      results.push({ taskId: job.taskId, status: 'completed', receipt });
      onEvent({ type: 'completed', taskId: job.taskId, receipt });
    } catch (error) {
      // 失败也要带得上"下一步做什么"，不然界面只剩一句 HTTP 429 可看。
      const classified = classifyError(error, { source: job.item.source });
      results.push({ taskId: job.taskId, status: 'failed', error: classified.message, kind: classified.kind, hint: classified.hint });
      onEvent({ type: 'failed', taskId: job.taskId, error: classified.message, kind: classified.kind, hint: classified.hint });
    } finally {
      active -= 1;
    }
  };

  const pump = async () => {
    while (!cancelled) {
      if (paused) { await settled(100); continue; }
      const job = queue[cursor++];
      if (!job) return;
      await runOne(job);
      maybeSettle();
    }
  };

  const workers = new Array(Math.min(limit, queue.length || 1)).fill(0).map(pump);
  workers.forEach((promise) => promise.then(() => maybeSettle()));

  const controller = {
    // 渲染层要按 taskId 对应进度，所以任务标识由队列统一生成并对外公布。
    jobs: queue.map((job) => ({
      taskId: job.taskId,
      source: job.item.source,
      sourceId: String(job.item.sourceId),
      title: String(job.item.title || '').slice(0, 120),
      thumbnailUrl: job.item.thumbnailUrl || '',
    })),
    get size() { return queue.length; },
    get active() { return active; },
    get paused() { return paused; },
    get cancelled() { return cancelled; },
    get completed() { return results.filter((r) => r.status === 'completed').length; },
    get failed() { return results.filter((r) => r.status === 'failed').length; },
    pause() { paused = true; onEvent({ type: 'paused', remaining: queue.length - cursor + active }); return { paused: true }; },
    resume() { paused = false; onEvent({ type: 'resumed' }); return { paused: false }; },
    cancel() {
      cancelled = true; paused = false;
      for (let i = cursor; i < queue.length; i += 1) {
        const job = queue[i];
        if (!results.some((r) => r.taskId === job.taskId)) {
          results.push({ taskId: job.taskId, status: 'cancelled' });
          onEvent({ type: 'cancelled', taskId: job.taskId });
        }
      }
      maybeSettle();
      onEvent({ type: 'cancelled_all', remaining: Math.max(0, queue.length - cursor) });
      return { cancelled: true, dropped: Math.max(0, queue.length - cursor) };
    },
    async wait() { await finished; return summary(); },
    results,
  };

  function summary() {
    const completed = results.filter((r) => r.status === 'completed');
    return {
      requested: queue.length,
      completed: completed.length,
      bytes: completed.reduce((sum, r) => sum + (r.receipt?.bytes || 0), 0),
      failed: results.filter((r) => r.status === 'failed').map((r) => ({ taskId: r.taskId, error: r.error, kind: r.kind, hint: r.hint })),
      cancelled: results.filter((r) => r.status === 'cancelled').length,
      files: completed.map((r) => r.receipt),
    };
  }

  return controller;
}

module.exports = {
  validateDownloadUrl,
  probeUrl,
  downloadItem,
  createDownloadQueue,
  resolveTarget,
  ensureDir,
  extensionFor,
  uniquePath,
  sanitizeSegment,
  applyTemplate,
  readDownloadLog,
  recordDownload,
  logFile,
  DEFAULT_TEMPLATE,
};
