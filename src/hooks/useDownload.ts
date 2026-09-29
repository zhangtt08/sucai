import { useState, useCallback, useEffect, useRef } from 'react';
import type { AssetItem, DownloadTask } from '../services/types';
import { downloadAsset, onDownloadProgress, selectDirectory, openInFolder } from '../services/ipc';

export function useDownload() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const sequenceRef = useRef(0);

  useEffect(() => onDownloadProgress(({ taskId, progress }) => {
    setTasks((previous) => previous.map((task) =>
      task.id === taskId && task.status === 'downloading'
        ? { ...task, progress: progress.percent, speed: progress.speed }
        : task
    ));
  }), []);

  const startDownload = useCallback(async (items: AssetItem[], preferredDirectory = ''): Promise<boolean> => {
    const dir = preferredDirectory || await selectDirectory();
    if (!dir || items.length === 0) return false;
    const batchId = Date.now();
    const newTasks: DownloadTask[] = items.map((item) => ({
      id: `${item.source}_${item.sourceId}_${batchId}_${sequenceRef.current++}`,
      item, status: 'pending' as const, progress: 0, speed: '',
    }));
    setTasks((previous) => [...newTasks, ...previous]);
    for (const task of newTasks) {
      setTasks((previous) => previous.map((current) =>
        current.id === task.id ? { ...current, status: 'downloading' } : current
      ));
      try {
        const filePath = await downloadAsset(task.item, dir, task.id);
        setTasks((previous) => previous.map((current) =>
          current.id === task.id
            ? { ...current, status: 'completed', progress: 100, speed: '', filePath }
            : current
        ));
      } catch (err: unknown) {
        setTasks((previous) => previous.map((current) =>
          current.id === task.id
            ? { ...current, status: 'failed', error: err instanceof Error ? err.message : '下载失败' }
            : current
        ));
      }
    }
    return true;
  }, []);

  const clearDone = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status === 'pending' || t.status === 'downloading'));
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tasks, startDownload, clearDone, removeTask, openInFolder };
}
