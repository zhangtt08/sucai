import { useEffect, useRef } from 'react';
import type { AssetItem } from '../services/types';
import { AlertIcon, CheckIcon, DownloadIcon, ImageIcon, RefreshIcon, SearchIcon, VideoIcon } from './Icons';

interface Props {
  items: AssetItem[];
  loading: boolean;
  error: string;
  warning: string;
  selected: Set<string>;
  onSelect: (item: AssetItem, multi: boolean) => void;
  onDownload: (item: AssetItem) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  hasMore: boolean;
}

const fallbackImage = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
    <rect width="640" height="480" fill="#e9edf5"/>
    <path d="M240 284l52-52a22 22 0 0131 0l29 29 23-23a22 22 0 0131 0l54 54v32H180v-8l60-32z" fill="#b5bfd1"/>
    <circle cx="398" cy="177" r="25" fill="#b5bfd1"/>
  </svg>
`)}`;

function SkeletonGrid() {
  return (
    <div className="masonry-grid" aria-label="正在加载素材">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
        <div className={`skeleton-card skeleton-card-${(item % 3) + 1}`} key={item}>
          <span className="skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

export function ThumbnailGrid({
  items,
  loading,
  error,
  warning,
  selected,
  onSelect,
  onDownload,
  onLoadMore,
  onRetry,
  hasMore,
}: Props) {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRootRef.current;
    if (!sentinel || !root || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) onLoadMore();
      },
      { root, rootMargin: '320px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-icon empty-icon-error"><AlertIcon className="size-7" /></div>
        <p className="eyebrow eyebrow-error">搜索未完成</p>
        <h2>素材平台暂时无法响应</h2>
        <p>{error}</p>
        <button className="button-secondary mt-5" onClick={onRetry} type="button">
          <RefreshIcon className="size-4" />
          重试
        </button>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><SearchIcon className="size-7" /></div>
        <p className="eyebrow">等待搜索</p>
        <h2>从一个关键词开始</h2>
        <p>输入主题、场景或风格，素材会集中显示在这里。</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-1" ref={scrollRootRef}>
      {warning && (
        <div className="search-warning" role="status">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <div><strong>部分来源需要处理</strong><span>{warning}</span></div>
        </div>
      )}
      {loading && items.length === 0 ? (
        <SkeletonGrid />
      ) : (
        <div className="masonry-grid">
          {items.map((item) => {
            const key = `${item.source}_${item.sourceId}`;
            const isSelected = selected.has(key);
            return (
              <article
                aria-selected={isSelected}
                className="thumbnail-card group"
                key={key}
              >
                <button
                  aria-label={`预览 ${item.title || '未命名素材'}`}
                  className="block w-full cursor-zoom-in text-left focus-visible:outline-none"
                  onClick={() => onSelect(item, false)}
                  type="button"
                >
                  <img
                    alt={item.title || '素材缩略图'}
                    className="block h-auto w-full bg-surface-muted"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = fallbackImage;
                    }}
                    src={item.thumbnailUrl}
                  />
                  <div className="thumbnail-overlay">
                    <p className="truncate text-xs font-medium text-white">{item.title || '未命名素材'}</p>
                    <p className="mt-0.5 truncate text-[11px] text-white/70">{item.author || '未知作者'}</p>
                  </div>
                </button>

                <span className="source-label">{item.sourceDisplayName || item.source}</span>
                {item.mediaType === 'video' && (
                  <span className="media-label">
                    <VideoIcon className="size-3" />
                    {item.duration ? `${Math.round(item.duration)} 秒` : '视频'}
                  </span>
                )}
                {item.mediaType === 'image' && (
                  <span className="sr-only"><ImageIcon />图片</span>
                )}

                <button
                  aria-label={isSelected ? '取消选择' : '选择素材'}
                  aria-pressed={isSelected}
                  className="select-control"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(item, true);
                  }}
                  type="button"
                >
                  <CheckIcon className="size-3.5" />
                </button>
                <button
                  aria-label={`下载 ${item.title || '图片'}`}
                  className="quick-download"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDownload(item);
                  }}
                  title="直接下载"
                  type="button"
                >
                  <DownloadIcon className="size-3.5" />
                </button>
              </article>
            );
          })}
        </div>
      )}

      <div className="flex min-h-16 items-center justify-center" ref={sentinelRef}>
        {loading && items.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="loading-ring" />
            正在加载更多素材
          </div>
        )}
        {!hasMore && items.length > 0 && (
          <p className="text-xs text-muted">已经到底了，共 {items.length} 项</p>
        )}
      </div>
    </div>
  );
}
