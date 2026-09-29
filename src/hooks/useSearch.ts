import { useState, useCallback, useRef } from 'react';
import type { AssetItem, PluginInfo } from '../services/types';
import { searchAssets, getPlugins } from '../services/ipc';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [sources, setSources] = useState<string[]>([]);
  const [results, setResults] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const loadPlugins = useCallback(async () => {
    try {
      const list = await getPlugins();
      setPlugins(list);
      const configured = list.filter((p) => p.configured).map((p) => p.name);
      setSources(configured);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '素材平台加载失败');
    }
  }, []);

  const search = useCallback(async (newQuery?: string, reset = true) => {
    const q = newQuery ?? query;
    if (!q.trim()) return;
    if (sources.length === 0) {
      setError('请先选择至少一个已配置的素材平台');
      return;
    }
    if (!reset && loadingMoreRef.current) return;
    if (!reset) loadingMoreRef.current = true;
    const requestId = ++requestIdRef.current;
    setLoading(true); setError(''); setWarning('');
    const currentPage = reset ? 1 : page;
    try {
      const { items, warnings } = await searchAssets(q, mediaType, sources, currentPage, 24);
      if (requestId !== requestIdRef.current) return;
      setWarning(warnings.join('；'));
      if (reset) {
        setResults(items);
        setPage(2);
      } else {
        setResults((previous) => {
          const merged = new Map(previous.map((item) => [`${item.source}_${item.sourceId}`, item]));
          items.forEach((item) => merged.set(`${item.source}_${item.sourceId}`, item));
          return Array.from(merged.values());
        });
        setPage((previousPage) => previousPage + 1);
      }
      setHasMore(items.length >= 24);
    } catch (err: unknown) {
      if (requestId === requestIdRef.current) {
        setError(err instanceof Error ? err.message : '搜索失败，请稍后重试');
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
      if (!reset) loadingMoreRef.current = false;
    }
  }, [query, mediaType, sources, page]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) search(query, false);
  }, [loading, hasMore, query, search]);

  return { query, setQuery, mediaType, setMediaType, sources, setSources, results, setResults, loading, error, warning, hasMore, plugins, loadPlugins, search, loadMore };
}
