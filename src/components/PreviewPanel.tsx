import type { AssetItem } from '../services/types';
import { DownloadIcon, ExternalLinkIcon, ImageIcon, VideoIcon, XIcon } from './Icons';

export function PreviewPanel({
  item,
  onClose,
  onDownload,
}: {
  item: AssetItem;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <aside className="preview-panel" aria-label="素材预览">
      <div className="panel-header">
        <div>
          <p className="eyebrow mb-0.5">素材详情</p>
          <h2 className="text-sm font-semibold text-ink dark:text-white">预览</h2>
        </div>
        <button aria-label="关闭预览" className="icon-button" onClick={onClose} type="button">
          <XIcon className="size-[18px]" />
        </button>
      </div>

      <div className="preview-media" key={`${item.source}_${item.sourceId}`}>
        {item.mediaType === 'video' ? (
          <video
            className="media-outline max-h-[360px] w-full rounded-xl"
            controls
            poster={item.previewUrl}
            preload="metadata"
            src={item.downloadUrl}
          />
        ) : (
          <img
            alt={item.title}
            className="media-outline max-h-[360px] w-full rounded-xl object-contain"
            referrerPolicy="no-referrer"
            src={item.previewUrl}
          />
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-accent">
            {item.mediaType === 'video'
              ? <VideoIcon className="size-3.5" />
              : <ImageIcon className="size-3.5" />}
            {item.sourceDisplayName || item.source}
          </div>
          <h3 className="text-pretty text-[15px] font-semibold leading-6 text-ink dark:text-white">
            {item.title || '未命名素材'}
          </h3>
          {item.author && (
            item.authorUrl ? (
              <a
                className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-accent"
                href={item.authorUrl}
                rel="noreferrer"
                target="_blank"
              >
                {item.author}
                <ExternalLinkIcon className="size-3" />
              </a>
            ) : (
              <p className="mt-2 text-xs text-muted">{item.author}</p>
            )
          )}
          {item.description && <p className="mt-3 text-xs leading-5 text-muted">{item.description}</p>}
        </div>

        <dl className="detail-grid">
          <div>
            <dt>类型</dt>
            <dd>{item.mediaType === 'video' ? '视频' : '图片'}</dd>
          </div>
          <div>
            <dt>尺寸</dt>
            <dd className="tabular-nums">{item.width || '—'} × {item.height || '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt>使用许可</dt>
            <dd>{item.license || '请查看来源平台条款'}</dd>
          </div>
        </dl>

        {item.tags?.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">标签</p>
            <div className="flex flex-wrap gap-1.5">
              {item.tags.slice(0, 12).map((tag) => <span className="tag" key={tag}>{tag}</span>)}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-structure p-4 dark:border-structure-dark">
        <button className="button-primary w-full justify-center" onClick={onDownload} type="button">
          <DownloadIcon className="size-4" />
          下载这项素材
        </button>
      </div>
    </aside>
  );
}
