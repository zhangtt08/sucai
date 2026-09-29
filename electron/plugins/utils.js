const fs = require('fs');
const https = require('https');
const http = require('http');

function downloadFile(url, destPath, onProgress, redirectCount = 0) {
  if (!url) return Promise.reject(new Error('下载地址为空'));
  if (redirectCount > 5) return Promise.reject(new Error('下载重定向次数过多'));

  return new Promise((resolve, reject) => {
    const tempPath = `${destPath}.part`;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      try { fs.rmSync(tempPath, { force: true }); } catch (_) {}
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      fail(new Error('下载地址无效'));
      return;
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      fail(new Error('仅支持 HTTP 或 HTTPS 下载地址'));
      return;
    }

    const proto = parsedUrl.protocol === 'https:' ? https : http;
    const request = proto.get(parsedUrl, {
      headers: { 'User-Agent': 'SucaiDownloader/1.0' },
    }, (res) => {
      const statusCode = res.statusCode || 0;
      if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
        res.resume();
        const redirectUrl = new URL(res.headers.location, parsedUrl).toString();
        settled = true;
        downloadFile(redirectUrl, destPath, onProgress, redirectCount + 1).then(resolve, reject);
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        res.resume();
        fail(new Error(`下载请求失败（HTTP ${statusCode || '未知'}）`));
        return;
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const start = Date.now();
      const file = fs.createWriteStream(tempPath);
      file.on('error', fail);
      res.on('error', fail);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (onProgress && total > 0) {
          const pct = Math.round((downloaded / total) * 100);
          const elapsedSeconds = (Date.now() - start) / 1000;
          onProgress({
            percent: pct,
            speed: elapsedSeconds > 0 ? formatSpeed(downloaded / elapsedSeconds) : '计算中',
          });
        }
      });
      file.on('finish', () => {
        file.close((closeError) => {
          if (closeError) return fail(closeError);
          try {
            fs.renameSync(tempPath, destPath);
            settled = true;
            resolve(destPath);
          } catch (error) {
            fail(error);
          }
        });
      });
      res.pipe(file);
    });
    request.setTimeout(30_000, () => request.destroy(new Error('下载连接超时')));
    request.on('error', fail);
  });
}

function formatSpeed(bps) {
  if (bps > 1048576) return `${(bps / 1048576).toFixed(1)} MB/s`;
  if (bps > 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${Math.round(bps)} B/s`;
}

module.exports = { downloadFile };
