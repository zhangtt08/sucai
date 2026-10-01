// 搜索入参归一 —— 界面 IPC、Agent 工具、旧 REST 三条入口共用同一套边界，
// 免得某一条漏了 clamp（历史上 perPage 只在主进程夹过）。
'use strict';

const MEDIA_TYPES = new Set(['image', 'video', 'all']);

function normalizeSearchInput(input = {}, settings = {}) {
  const query = String(input.query ?? '').trim().replace(/\s+/g, ' ').slice(0, 200);
  const mediaType = MEDIA_TYPES.has(input.mediaType) ? input.mediaType : 'image';
  const page = Math.max(1, Math.min(Number(input.page) || 1, 100));
  // 下界 3 不是随手写的：Pixabay 的 per_page < 3 会直接返回 [ERROR 400]。
  const perPage = Math.max(3, Math.min(Number(input.perPage) || settings.pageSize || 24, 60));
  const sources = Array.isArray(input.sources)
    ? [...new Set(input.sources.map(String).filter(Boolean))].slice(0, 20)
    : [];
  return { query, mediaType, page, perPage, sources };
}

function searchInputError({ query }) {
  if (!query) return '请输入搜索关键词';
  if (query.length < 2) return '关键词太短，至少 2 个字符';
  return '';
}

module.exports = { normalizeSearchInput, searchInputError, MEDIA_TYPES };
