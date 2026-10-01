import { useEffect, useState } from 'react';
import { DownloadPanel } from './components/DownloadPanel';
import { BrandMark, DownloadIcon, SettingsIcon, SparklesIcon } from './components/Icons';
import { PreviewPanel } from './components/PreviewPanel';
import { SearchBar } from './components/SearchBar';
import { SettingsDialog } from './components/SettingsDialog';
import { ThumbnailGrid } from './components/ThumbnailGrid';
import { WindowControls } from './components/WindowControls';
import { useDownload } from './hooks/useDownload';
import { useSearch } from './hooks/useSearch';
import { useSettings } from './hooks/useSettings';
import type { AssetItem } from './services/types';

export default function App() {
  const search = useSearch();
  const download = useDownload();
  const { settings, loaded, loadError, updateAndSave } = useSettings();

  const [previewItem, setPreviewItem] = useState<AssetItem | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    search.loadPlugins();
  }, [search.loadPlugins]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    document.documentElement.style.colorScheme = settings.theme;
  }, [settings.theme]);

  const needsSetup = loaded && search.plugins.length > 0 &&
    !search.plugins.some((plugin) => plugin.configured);

  const handleSelect = (item: AssetItem, multi: boolean) => {
    if (!multi) {
      setPreviewItem(item);
      return;
    }
    setSelected((previous) => {
      const next = new Set(previous);
      const key = `${item.source}_${item.sourceId}`;
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const beginDownload = async (items: AssetItem[]) => {
    if (items.length === 0) return false;
    const started = await download.startDownload(items, settings.downloadDir);
    if (started) setShowDownloads(true);
    return started;
  };

  const handleDownloadSelected = async () => {
    const items = search.results.filter((item) => selected.has(`${item.source}_${item.sourceId}`));
    if (await beginDownload(items)) setSelected(new Set());
  };

  if (!loaded) {
    return (
      <div className="app-shell items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandMark className="size-14 shadow-lg" />
          <div>
            <p className="text-sm font-semibold text-ink dark:text-white">正在准备素材工作台</p>
            <p className="mt-1 text-xs text-muted">读取设置与素材平台…</p>
          </div>
          <span className="loading-ring" aria-label="正在加载" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header drag-region" onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        void window.electron.windowControls.toggleMaximize();
      }}>
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark />
          <div className="min-w-0">
            <h1 className="text-balance text-[15px] font-semibold leading-5 text-ink dark:text-white">
              素材下载器
            </h1>
            <p className="truncate text-[11px] text-muted">跨平台图片与视频素材工作台</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={`header-action ${showDownloads ? 'header-action-active' : ''}`}
            onClick={() => setShowDownloads((visible) => !visible)}
            type="button"
          >
            <DownloadIcon className="size-[18px]" />
            <span>下载</span>
            <span className="count-badge">{download.tasks.length}</span>
          </button>
          <button className="header-action" onClick={() => setShowSettings(true)} type="button">
            <SettingsIcon className="size-[18px]" />
            <span>设置</span>
          </button>
          <div className="no-drag -mr-5 h-full">
            <WindowControls />
          </div>
        </div>
      </header>

      <SearchBar
        loading={search.loading}
        mediaType={search.mediaType}
        onMediaTypeChange={search.setMediaType}
        onQueryChange={search.setQuery}
        onSearch={() => search.search()}
        onSourcesChange={search.setSources}
        plugins={search.plugins}
        query={search.query}
        sources={search.sources}
      />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <section className="min-w-0 flex-1 bg-canvas p-4 dark:bg-night">
          {needsSetup ? (
            <div className="empty-state">
              <div className="empty-illustration">
                <SparklesIcon className="size-8" />
                <span className="empty-illustration-card empty-illustration-card-one" />
                <span className="empty-illustration-card empty-illustration-card-two" />
              </div>
              <p className="eyebrow">首次使用</p>
              <h2>连接素材平台，开始建立你的素材库</h2>
              <p>配置至少一个平台的 API Key，即可统一搜索并下载图片和视频。</p>
              <button className="button-primary mt-5" onClick={() => setShowSettings(true)} type="button">
                <SettingsIcon className="size-4" />
                配置素材平台
              </button>
            </div>
          ) : (
            <ThumbnailGrid
              error={search.error || loadError}
              warning={search.warning}
              hasMore={search.hasMore}
              items={search.results}
              loading={search.loading}
              onLoadMore={search.loadMore}
              onDownload={(item) => beginDownload([item])}
              onRetry={() => search.search(undefined, true)}
              onSelect={handleSelect}
              selected={selected}
            />
          )}
        </section>

        {previewItem && (
          <PreviewPanel
            item={previewItem}
            onClose={() => setPreviewItem(null)}
            onDownload={() => beginDownload([previewItem])}
          />
        )}
      </main>

      {search.results.length > 0 && (
        <footer className="status-bar">
          <span className="tabular-nums">
            {selected.size > 0 ? `已选择 ${selected.size} 项` : `共找到 ${search.results.length} 项素材`}
          </span>
          <div className="flex-1" />
          {selected.size > 0 && (
            <button className="button-primary button-small" onClick={handleDownloadSelected} type="button">
              <DownloadIcon className="size-4" />
              下载选中
            </button>
          )}
          {search.results.length > 0 && (
            <button
              className="button-secondary button-small"
              onClick={() => beginDownload(search.results)}
              type="button"
            >
              下载全部
            </button>
          )}
        </footer>
      )}

      {showSettings && (
        <SettingsDialog
          onClose={() => setShowSettings(false)}
          onPluginsReload={search.loadPlugins}
          onSave={updateAndSave}
          settings={settings}
        />
      )}
      {showDownloads && (
        <DownloadPanel
          onClear={download.clearDone}
          onClose={() => setShowDownloads(false)}
          onOpenFolder={download.openInFolder}
          onRemove={download.removeTask}
          tasks={download.tasks}
        />
      )}
    </div>
  );
}
