import { useCallback, useEffect, useMemo, useState } from 'react';
import { batchCancel, batchPause, batchResume, inDesktop, openInFolder, onDownloadEvent, selectDirectory, startBatch } from '../services/ipc';
import type { AssetItem, DownloadTask } from '../services/types';

interface BatchState {
  paused: boolean;
  done: boolean;
}

export function useDownload() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [batches, setBatches] = useState<Record<string, BatchState>>({});

  useEffect(() => {
    if (!inDesktop()) return;
    return onDownloadEvent((event) => {
      const { batchId } = event;
      switch (event.type) {
        case 'started':
          patch(batchId, event.taskId, () => ({ status: 'downloading' }));
          break;
        case 'progress':
          patch(batchId, event.taskId, (task) => ({ ...task, progress: event.progress.percent, speed: event.progress.speed }));
          break;
        case 'completed':
          patch(batchId, event.taskId, (task) => ({
            ...task,
            status: 'completed',
            progress: 100,
            speed: '',
            filePath: event.receipt.filePath,
            fileName: event.receipt.fileName,
            bytes: event.receipt.bytes,
          }));
          break;
        case 'failed':
          patch(batchId, event.taskId, (task) => ({ ...task, status: 'failed', speed: '', error: event.error }));
          break;
        case 'cancelled':
          patch(batchId, event.taskId, (task) => ({ ...task, status: 'cancelled', speed: '' }));
          break;
        case 'paused':
          setBatches((previous) => ({ ...previous, [batchId]: { paused: true, done: false } }));
          break;
        case 'resumed':
          setBatches((previous) => ({ ...previous, [batchId]: { paused: false, done: false } }));
          break;
        case 'batch-done':
          setBatches((previous) => ({ ...previous, [batchId]: { paused: false, done: true } }));
          break;
        case 'cancelled_all':
          break;
      }
    });

    function patch(batchId: string, taskId: string, make: (task: DownloadTask) => Partial<DownloadTask>) {
      setTasks((previous) => previous.map((task) => (task.batchId === batchId && task.id === taskId ? { ...task, ...make(task) } : task)));
    }
  }, []);

  const startDownload = useCallback(async (items: AssetItem[], preferredDirectory = '', query = ''): Promise<boolean> => {
    if (!items.length || !inDesktop()) return false;
    const dir = preferredDirectory || await selectDirectory();
    if (!dir) return false;
    try {
      const { batchId, jobs } = await startBatch(items, dir, query);
      const created: DownloadTask[] = jobs.map((job) => {
        const item = items.find((candidate) => `${candidate.source}_${candidate.sourceId}` === `${job.source}_${job.sourceId}`) || ({} as AssetItem);
        return {
          id: job.taskId,
          batchId,
          item,
          status: 'queued' as const,
          progress: 0,
          speed: '',
          fileName: job.title,
        };
      });
      setBatches((previous) => ({ ...previous, [batchId]: { paused: false, done: false } }));
      setTasks((previous) => [...created, ...previous]);
      return true;
    } catch (error: unknown) {
      // 队列起不来（目录不可写/未设置）也要在任务列表里留下一行，不能表现得像没点。
      const message = error instanceof Error ? error.message : '无法开始下载';
      setTasks((previous) => [
        ...items.map((item, index) => ({
          id: `error_${Date.now()}_${index}`, batchId: 'error', item,
          status: 'failed' as const, progress: 0, speed: '', error: message,
        })),
        ...previous,
      ]);
      return true;
    }
  }, []);

  const control = useCallback(async (batchId: string, action: 'pause' | 'resume' | 'cancel') => {
    if (!batchId) return;
    const result = action === 'pause' ? await batchPause(batchId) : action === 'resume' ? await batchResume(batchId) : await batchCancel(batchId);
    if (!result.success) {
      setTasks((previous) => previous.map((task) => (task.batchId === batchId && task.status === 'queued' ? { ...task, status: 'cancelled', error: result.error } : task)));
    }
  }, []);

  const retryFailed = useCallback(async (destDir: string, query = '') => {
    const failed = tasks.filter((task) => task.status === 'failed');
    if (!failed.length) return false;
    setTasks((previous) => previous.filter((task) => task.status !== 'failed'));
    return startDownload(failed.map((task) => task.item), destDir, query);
  }, [tasks, startDownload]);

  const clearSettled = useCallback(() => {
    setTasks((previous) => previous.filter((task) => task.status === 'queued' || task.status === 'downloading'));
    setBatches((previous) => {
      const next: Record<string, BatchState> = {};
      for (const [id, state] of Object.entries(previous)) if (!state.done) next[id] = state;
      return next;
    });
  }, []);

  const openFolder = useCallback(async (filePath: string) => { await openInFolder(filePath); }, []);

  const stats = useMemo(() => {
    const by = (status: DownloadTask['status']) => tasks.filter((task) => task.status === status);
    const running = by('downloading');
    const settled = [...by('completed'), ...by('failed'), ...by('cancelled')];
    const openBatches = Object.entries(batches).filter(([, state]) => !state.done);
    return {
      queued: by('queued').length,
      running: running.length,
      completed: by('completed').length,
      failed: by('failed').length,
      cancelled: by('cancelled').length,
      bytes: by('completed').reduce((sum, task) => sum + (task.bytes || 0), 0),
      paused: openBatches.some(([, state]) => state.paused),
      activeBatchId: openBatches[0]?.[0] || '',
      batchCount: openBatches.length,
      settledCount: settled.length,
    };
  }, [tasks, batches]);

  return {
    tasks, stats, startDownload, clearSettled, openFolder,
    pause: () => control(stats.activeBatchId, 'pause'),
    resume: () => control(stats.activeBatchId, 'resume'),
    cancel: () => control(stats.activeBatchId, 'cancel'),
    retryFailed,
  };
}
