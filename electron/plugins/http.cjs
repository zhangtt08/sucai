// 插件共用的 HTTP 入口：统一超时 + 统一错误归类。
// 之前每个插件各写一份 fetch + `HTTP ${status}`，既没有超时（一个卡住的源会拖住整次搜索），
// 报错也没法照着做 —— 现在都从这里出去。
'use strict';

const { classifyError } = require('../core/errors.cjs');

const DEFAULT_TIMEOUT_MS = 15_000;
// Wikimedia / Met / Artic 会掐断通用程序 UA 的连接。
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

async function request(url, { headers, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response;
  } catch (error) {
    throw classifyError(error, { source: headers?.__source });
  }
}

async function jsonFetch(url, options = {}) {
  const response = await request(url, options);
  const status = response.status;
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.text();
      detail = (body || '').replace(/\s+/g, ' ').slice(0, 200);
    } catch (_) {}
    // 平台常把"为什么"写在 body 里（Met 的 410 就直接给了替代端点），别丢掉。
    throw classifyError(new Error(detail), { status, source: options.source });
  }
  try {
    return await response.json();
  } catch (error) {
    throw classifyError(new Error(`平台返回的不是 JSON（HTTP ${status}）`), { source: options.source });
  }
}

module.exports = { jsonFetch, request, BROWSER_UA, DEFAULT_TIMEOUT_MS };
