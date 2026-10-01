// 错误归类与"可执行出路" —— 纯 Node 模块，不依赖 electron，
// electron 主进程与 agent/tools.mjs 共用同一份判定，避免两套说法。
'use strict';

const KINDS = {
  no_key: {
    label: '缺少密钥',
    hint: '该来源需要免费 API Key：打开「设置 → 素材平台」粘贴密钥后重试。',
    fix: 'settings',
    retryable: false,
  },
  unauthorized: {
    label: '授权被拒',
    hint: '密钥无效、过期或没有该接口权限：重新复制一次密钥（注意别带上空格），并确认账号已开通对应 API。',
    fix: 'settings',
    retryable: false,
  },
  rate_limited: {
    label: '触发限速',
    hint: '该来源的配额已用完：等几分钟再重试，或先换其他素材源；需要更多配额要到平台后台提升档位。',
    fix: 'wait',
    retryable: true,
  },
  gone: {
    label: '接口已下线',
    hint: '平台已经废弃这个接口端点，需要升级本项目的来源插件。',
    fix: 'upgrade',
    retryable: false,
  },
  not_found: {
    label: '接口不存在',
    hint: '请求端点不存在（多半是接口路径变更）：换个关键词试试，或检查该来源是否需要密钥。',
    fix: 'upgrade',
    retryable: false,
  },
  server: {
    label: '平台故障',
    hint: '对方服务器暂时不可用：稍后重试，或先换其他素材源。',
    fix: 'retry',
    retryable: true,
  },
  network: {
    label: '连接不上',
    hint: '本机无法访问该域名：检查网络与代理设置（公司网络/加速器常拦截 API 域名），确认防火墙没有拦下本应用。',
    fix: 'network',
    retryable: true,
  },
  timeout: {
    label: '响应超时',
    hint: '该来源响应过慢：重试一次，或先换其他素材源。',
    fix: 'retry',
    retryable: true,
  },
  bad_response: {
    label: '返回格式异常',
    hint: '返回内容不是预期格式（可能被网关/登录页拦截）：检查代理设置后重试。',
    fix: 'network',
    retryable: true,
  },
  unsupported: {
    label: '该来源不支持',
    hint: '这个素材源没有这类内容：切换到其他支持该类型的来源。',
    fix: 'switch_source',
    retryable: false,
  },
  unknown: {
    label: '未知错误',
    hint: '重试一次；若持续失败，换其他素材源。',
    fix: 'retry',
    retryable: true,
  },
};

class SourceError extends Error {
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'SourceError';
    this.kind = KINDS[kind] ? kind : 'unknown';
    this.status = extra.status;
    this.source = extra.source;
    const meta = KINDS[this.kind];
    this.label = meta.label;
    this.hint = extra.hint || meta.hint;
    this.fix = meta.fix;
    this.retryable = meta.retryable;
  }
  toJSON() {
    return {
      kind: this.kind,
      label: this.label,
      message: this.message,
      hint: this.hint,
      fix: this.fix,
      retryable: this.retryable,
      status: this.status,
      source: this.source,
    };
  }
}

const HTTP_KINDS = {
  400: 'bad_response',
  401: 'unauthorized',
  403: 'unauthorized',
  404: 'not_found',
  408: 'timeout',
  409: 'rate_limited',
  410: 'gone',
  413: 'bad_response',
  414: 'bad_response',
  422: 'bad_response',
  429: 'rate_limited',
};

function kindFromStatus(status) {
  const code = Number(status);
  if (HTTP_KINDS[code]) return HTTP_KINDS[code];
  if (code >= 500) return 'server';
  if (code >= 400) return 'bad_response';
  return 'unknown';
}

// 从一个原始异常/HTTP 状态推出归类，尽量保留平台自己写的原因。
function classifyError(err, { source, status, needsKey } = {}) {
  if (err instanceof SourceError) {
    if (!err.source && source) err.source = source;
    return err;
  }
  if (needsKey) return new SourceError('no_key', '尚未配置 API Key', { source });

  const code = status !== undefined ? Number(status) : err && err.status;
  if (code) {
    const raw = err instanceof Error ? err.message : String(err || '');
    const detail = raw && !/HTTP\s*\d{3}/i.test(raw) ? ` · ${raw.slice(0, 120)}` : '';
    return new SourceError(kindFromStatus(code), `平台返回 HTTP ${code}${detail}`, { source, status: code });
  }

  const name = err && err.name;
  const msg = String((err && err.message) || err || '请求失败');
  if (name === 'AbortError' || /timeout|超时|ETIMEDOUT/i.test(msg)) {
    return new SourceError('timeout', '请求超时', { source });
  }
  if (name === 'TypeError' || /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|proxy|socket hang up/i.test(msg)) {
    return new SourceError('network', `无法连接平台：${msg.slice(0, 120)}`, { source });
  }
  if (/JSON|Unexpected token|not valid JSON/i.test(msg)) {
    return new SourceError('bad_response', '返回内容无法解析', { source });
  }
  const embedded = msg.match(/HTTP\s+(\d{3})/i);
  if (embedded) {
    return new SourceError(kindFromStatus(embedded[1]), `平台返回 HTTP ${embedded[1]}`, { source, status: Number(embedded[1]) });
  }
  if (/429|rate limit|too many requests|quota/i.test(msg)) {
    return new SourceError('rate_limited', msg.slice(0, 120), { source });
  }
  return new SourceError('unknown', msg.slice(0, 160), { source });
}

module.exports = { KINDS, SourceError, classifyError, kindFromStatus };
