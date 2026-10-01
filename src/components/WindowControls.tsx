import { useEffect, useState } from 'react';

function useMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const ec = window.electron;
    if (!ec?.windowControls) return;
    ec.windowControls.isMaximized().then(setMaximized);
    return ec.windowControls.onMaximizedChange(setMaximized);
  }, []);
  return maximized;
}

/** 自绘窗口控制三键：最小化 / 最大化-还原 / 关闭。放在自绘标题栏的最右端。 */
export function WindowControls() {
  const maximized = useMaximized();
  const base =
    'win-btn grid h-full w-12 place-items-center text-muted transition-colors hover:bg-[var(--surface-hover)] hover:text-ink dark:hover:bg-white/10 dark:hover:text-white';
  return (
    <div className="flex h-full items-center">
      <button aria-label="最小化" className={base} onClick={() => window.electron.windowControls.minimize()} type="button">
        <svg height="10" viewBox="0 0 10 10" width="10"><path d="M0 5h10" stroke="currentColor" strokeWidth="1" /></svg>
      </button>
      <button
        aria-label={maximized ? '还原' : '最大化'}
        className={base}
        onClick={() => window.electron.windowControls.toggleMaximize()}
        type="button"
      >
        {maximized ? (
          <svg height="10" viewBox="0 0 10 10" width="10">
            <path d="M2.5 2.5V1h7v7H8" fill="none" stroke="currentColor" strokeWidth="1" />
            <rect fill="none" height="6.5" stroke="currentColor" strokeWidth="1" width="6.5" x="0.5" y="2.5" />
          </svg>
        ) : (
          <svg height="10" viewBox="0 0 10 10" width="10">
            <rect fill="none" height="8" stroke="currentColor" strokeWidth="1" width="8" x="1" y="1" />
          </svg>
        )}
      </button>
      <button
        aria-label="关闭"
        className={`${base} win-btn-close`}
        onClick={() => window.electron.windowControls.close()}
        type="button"
      >
        <svg height="10" viewBox="0 0 10 10" width="10"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" /></svg>
      </button>
    </div>
  );
}
