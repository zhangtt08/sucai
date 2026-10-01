// 小型并发工具 —— 纯 Node，界面与 Agent 共用。
'use strict';

// 最多 limit 个任务同时在跑，保持输入顺序返回结果；单个失败不拖垮整批。
async function mapLimit(items, limit, worker) {
  const size = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
  const results = new Array(items.length);
  let cursor = 0;
  const runners = new Array(size).fill(0).map(async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index], index) };
      } catch (error) {
        results[index] = { status: 'rejected', reason: error };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

module.exports = { mapLimit };
