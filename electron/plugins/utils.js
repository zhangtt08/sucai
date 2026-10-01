const fs = require('fs');
const https = require('https');
const http = require('http');

// 浏览器化的取图头：实测芝加哥艺术馆的 IIIF 直链缺 Referer 会回 403 + HTML 错误页，
// 只带 SucaiDownloader UA 也一样被拦；补上 Referer 后同一 URL 返回 200 image/jpeg。
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function headersFor(url) {
  const headers = {
    'User-Agent': BROWSER_UA,
    Accept: 'image/avif,image/webp,image/apng,image/*,video/*,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  };
  try {
    headers.Referer = `${new URL(url).origin}/`;
  } catch (_) { /* 解析不了就不带 Referer，交给上层报错 */ }
  return headers;
}

// 服务器回 200 但内容是 HTML 错误页时不能把它当图片落盘。
function looksLikeHtml(contentType) {
  return /text\/html|application\/xml/i.test(String(contentType || ''));
}

function downloadFile(url, destPath, onProgress, redirectCount = 0, headers = null) {
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
      headers: headers || headersFor(parsedUrl.toString()),
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
        const why = statusCode === 403 ? '（被平台拒绝：可能缺少 Referer/UA，或该素材不允许直接下载）' : '';
        res.resume();
        fail(new Error(`下载请求失败（HTTP ${statusCode || '未知'}）${why}`));
        return;
      }
      if (looksLikeHtml(res.headers['content-type'])) {
        res.resume();
        fail(new Error('平台返回的是网页而不是素材文件（通常是风控或链接过期），请重新搜索后再试'));
        return;
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const start = Date.now();
      let lastReport = 0;
      const file = fs.createWriteStream(tempPath);
      file.on('error', fail);
      res.on('error', fail);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (onProgress && total > 0 && Date.now() - lastReport > 120) {
          lastReport = Date.now();
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
            if (!fs.statSync(tempPath).size) return fail(new Error('下载内容为空文件'));
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

module.exports = { downloadFile, headersFor, BROWSER_UA };
