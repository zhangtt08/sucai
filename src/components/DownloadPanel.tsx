import type { DownloadTask } from '../services/types';
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  FolderIcon,
  TrashIcon,
  XIcon,
} from './Icons';

interface Props {
  tasks: DownloadTask[];
  onClose: () => void;
  onClear: () => void;
  onRemove: (id: string) => void;
  onOpenFolder: (filePath: string) => void;
}

function StatusIcon({ status }: { status: DownloadTask['status'] }) {
  if (status === 'completed') return <CheckIcon className="size-3.5 text-success" />;
  if (status === 'failed') return <AlertIcon className="size-3.5 text-danger" />;
  if (status === 'downloading') return <DownloadIcon className="size-3.5 text-accent" />;
  return <ClockIcon className="size-3.5 text-muted" />;
}

export function DownloadPanel({ tasks, onClose, onClear, onRemove, onOpenFolder }: Props) {
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const failed = tasks.filter((task) => task.status === 'failed').length;
  const active = tasks.filter((task) => task.status === 'downloading').length;
  const pending = tasks.filter((task) => task.status === 'pending').length;

  return (
    <div
      aria-label="下载队列"
      aria-modal="true"
      className="drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <aside className="download-drawer">
        <div className="panel-header px-5 py-4">
          <div>
            <p className="eyebrow mb-0.5">任务管理</p>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-white">
              下载队列
              {(active + pending) > 0 && (
                <span className="status-pill tabular-nums">{active} 进行中 · {pending} 等待</span>
              )}
            </h2>
          </div>
          <button aria-label="关闭下载队列" className="icon-button" onClick={onClose} type="button">
            <XIcon className="size-[18px]" />
          </button>
        </div>

        <div className="download-summary">
          <span><DownloadIcon className="size-3.5 text-accent" />{active} 下载中</span>
          <span><CheckIcon className="size-3.5 text-success" />{completed} 已完成</span>
          <span><AlertIcon className="size-3.5 text-danger" />{failed} 失败</span>
        </div>

        <div className="flex-1 overflow-y-auto" aria-live="polite">
          {tasks.length === 0 ? (
            <div className="empty-state h-full min-h-0 px-8">
              <div className="empty-icon"><DownloadIcon className="size-7" /></div>
              <h2>还没有下载任务</h2>
              <p>从素材列表选择内容，下载进度会显示在这里。</p>
            </div>
          ) : (
            <div className="divide-y divide-structure dark:divide-structure-dark">
              {tasks.map((task) => (
                <article className="download-row" key={task.id}>
                  <img
                    alt=""
                    className="media-outline size-12 shrink-0 rounded-lg bg-surface-muted object-cover"
                    src={task.item.thumbnailUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink dark:text-white">
                      {task.item.title || '未命名素材'}
                    </p>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
                      <StatusIcon status={task.status} />
                      <span className="truncate">
                        {task.status === 'pending' && '等待下载'}
                        {task.status === 'downloading' && `${task.progress}%${task.speed ? ` · ${task.speed}` : ''}`}
                        {task.status === 'completed' && '下载完成'}
                        {task.status === 'failed' && (task.error || '下载失败')}
                      </span>
                    </div>
                    {task.status === 'downloading' && (
                      <div
                        aria-label={`下载进度 ${task.progress}%`}
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={task.progress}
                        className="progress-track"
                        role="progressbar"
                      >
                        <span
                          className="progress-value"
                          style={{ transform: `scaleX(${Math.max(0, Math.min(task.progress, 100)) / 100})` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {task.status === 'completed' && task.filePath && (
                      <button
                        aria-label="在文件夹中显示"
                        className="icon-button"
                        onClick={() => onOpenFolder(task.filePath!)}
                        title="在文件夹中显示"
                        type="button"
                      >
                        <FolderIcon className="size-4" />
                      </button>
                    )}
                    {(task.status === 'completed' || task.status === 'failed') && (
                      <button
                        aria-label="移除任务"
                        className="icon-button"
                        onClick={() => onRemove(task.id)}
                        title="移除任务"
                        type="button"
                      >
                        <XIcon className="size-4" />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {(completed > 0 || failed > 0) && (
          <div className="border-t border-structure p-4 dark:border-structure-dark">
            <button className="button-secondary w-full justify-center" onClick={onClear} type="button">
              <TrashIcon className="size-4" />
              清除已结束任务
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
