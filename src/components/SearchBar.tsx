import type { FormEvent } from 'react';
import type { PluginInfo } from '../services/types';
import { ImageIcon, LayersIcon, SearchIcon, VideoIcon } from './Icons';

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  mediaType: string;
  onMediaTypeChange: (value: string) => void;
  sources: string[];
  onSourcesChange: (value: string[]) => void;
  plugins: PluginInfo[];
  onSearch: () => void;
  loading: boolean;
}

const mediaTypes = [
  { value: 'image', label: '图片', icon: ImageIcon },
  { value: 'video', label: '视频', icon: VideoIcon },
  { value: 'all', label: '全部', icon: LayersIcon },
];

export function SearchBar({
  query,
  onQueryChange,
  mediaType,
  onMediaTypeChange,
  sources,
  onSourcesChange,
  plugins,
  onSearch,
  loading,
}: Props) {
  const toggleSource = (name: string) => {
    onSourcesChange(
      sources.includes(name)
        ? sources.filter((source) => source !== name)
        : [...sources, name],
    );
  };

  return (
    <section className="search-deck" aria-label="素材搜索">
      <form
        className="search-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          aria-label="搜索关键词"
          autoFocus
          className="search-input"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索照片、插画或视频…"
          type="search"
          value={query}
        />
        <button
          className="button-primary min-w-[94px] justify-center"
          disabled={loading || !query.trim() || sources.length === 0}
          type="submit"
        >
          {loading ? <span className="loading-ring loading-ring-light" /> : <SearchIcon className="size-4" />}
          {loading ? '搜索中' : '搜索'}
        </button>
      </form>

      <div className="filter-row">
        <div className="segmented-control" aria-label="素材类型">
          {mediaTypes.map(({ value, label, icon: MediaIcon }) => (
            <button
              aria-pressed={mediaType === value}
              className="segment-button"
              key={value}
              onClick={() => onMediaTypeChange(value)}
              type="button"
            >
              <MediaIcon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        <span className="filter-divider" />
        <span className="filter-label">素材源</span>

        <div className="flex flex-wrap items-center gap-2">
          {plugins.map((plugin) => {
            const selected = sources.includes(plugin.name);
            return (
              <button
                aria-pressed={selected}
                className="source-chip"
                disabled={!plugin.configured}
                key={plugin.name}
                onClick={() => toggleSource(plugin.name)}
                title={plugin.configured ? plugin.displayName : `${plugin.displayName} 尚未配置`}
                type="button"
              >
                <span className={`source-dot source-dot-${plugin.name}`} />
                {plugin.displayName}
                {!plugin.configured && <span className="source-state">未配置</span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
