const net = require('node:net');
const tls = require('node:tls');
const https = require('node:https');
const { run } = require('./commandRunner');

const COMMON_LOCAL_PORTS = [10808, 10809, 7890, 7897, 8080];
const CACHE_TTL = 60_000;
let cache = null;

function canConnect(host, port, timeout = 800) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (value) => { socket.destroy(); resolve(value); };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeProxyValue(value) {
  let text = String(value || '').trim().replace(/^['"]|['"]$/g, '');
  if (!text || /direct access|直接访问|无代理/i.test(text)) return '';
  if (text.includes(';')) {
    const entries = Object.fromEntries(text.split(';').map((part) => part.split('=', 2)).filter((part) => part.length === 2));
    text = entries.https || entries.http || '';
  }
  text = text.replace(/^https?=/i, '').trim();
  if (!text) return '';
  if (!/^https?:\/\//i.test(text)) text = `http://${text}`;
  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return '';
    if (!parsed.port) parsed.port = parsed.protocol === 'https:' ? '443' : '80';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

async function registryProxyCandidates() {
  if (process.platform !== 'win32') return [];
  const result = await run('reg.exe', [
    'query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
  ], { allowFailure: true });
  if (result.code !== 0 || !/ProxyEnable\s+REG_DWORD\s+0x1/i.test(result.stdout)) return [];
  const match = result.stdout.match(/ProxyServer\s+REG_SZ\s+(.+)/i);
  return match ? [normalizeProxyValue(match[1])] : [];
}

async function winHttpProxyCandidates() {
  if (process.platform !== 'win32') return [];
  const result = await run('netsh.exe', ['winhttp', 'show', 'proxy'], { allowFailure: true });
  if (result.code !== 0) return [];
  const lines = result.stdout.split(/\r?\n/);
  const candidate = lines.map((line) => line.match(/(?:Proxy Server\(s\)|代理服务器)\s*:\s*(.+)/i)?.[1]).find(Boolean);
  return candidate ? [normalizeProxyValue(candidate)] : [];
}

function environmentProxyCandidates() {
  return [process.env.HTTPS_PROXY, process.env.https_proxy, process.env.HTTP_PROXY, process.env.http_proxy]
    .map(normalizeProxyValue);
}

async function systemProxyCandidates() {
  const [registry, winHttp] = await Promise.all([registryProxyCandidates(), winHttpProxyCandidates()]);
  return unique([...environmentProxyCandidates(), ...registry, ...winHttp]);
}

function probeDirect(timeout = 2500) {
  return new Promise((resolve) => {
    const request = https.request({
      hostname: 'api.openai.com',
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout,
      headers: { 'User-Agent': 'web-mcp-assistant-network-check' }
    }, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.once('timeout', () => { request.destroy(); resolve(false); });
    request.once('error', () => resolve(false));
    request.end();
  });
}

function probeHttpProxy(proxyUrl, timeout = 2500) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(proxyUrl); } catch { resolve(false); return; }
    const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
    const connect = parsed.protocol === 'https:' ? tls.connect : net.connect;
    const socket = connect({ host: parsed.hostname, port, servername: parsed.protocol === 'https:' ? parsed.hostname : undefined });
    let settled = false;
    let response = '';
    const done = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeout);
    socket.once(parsed.protocol === 'https:' ? 'secureConnect' : 'connect', () => {
      socket.write('CONNECT api.openai.com:443 HTTP/1.1\r\nHost: api.openai.com:443\r\nConnection: close\r\n\r\n');
    });
    socket.on('data', (chunk) => {
      response += chunk.toString('latin1');
      if (response.includes('\r\n')) done(/^HTTP\/1\.[01] 2\d\d/i.test(response));
    });
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.once('end', () => done(/^HTTP\/1\.[01] 2\d\d/i.test(response)));
  });
}

async function commonLocalCandidates() {
  const checks = await Promise.all(COMMON_LOCAL_PORTS.map(async (port) => (
    await canConnect('127.0.0.1', port, 250) ? `http://127.0.0.1:${port}` : ''
  )));
  return checks.filter(Boolean);
}

async function firstWorkingProxy(candidates) {
  for (const url of unique(candidates)) {
    if (await probeHttpProxy(url)) return url;
  }
  return '';
}

async function resolveProxy(settings, options = {}) {
  const mode = ['auto', 'system', 'manual', 'direct'].includes(settings.proxyMode) ? settings.proxyMode : 'auto';
  const key = JSON.stringify({ mode, proxyUrl: settings.proxyUrl || '' });
  if (!options.force && cache && cache.key === key && Date.now() - cache.time < CACHE_TTL) return cache.value;

  let value;
  if (mode === 'direct') {
    value = { mode, resolvedUrl: '', source: 'direct', reachable: await probeDirect() };
  } else if (mode === 'manual') {
    const resolvedUrl = normalizeProxyValue(settings.proxyUrl);
    value = { mode, resolvedUrl, source: 'manual', reachable: Boolean(resolvedUrl && await probeHttpProxy(resolvedUrl)) };
  } else {
    const system = await systemProxyCandidates();
    if (mode === 'system') {
      const resolvedUrl = await firstWorkingProxy(system);
      value = resolvedUrl
        ? { mode, resolvedUrl, source: 'system', reachable: true }
        : { mode, resolvedUrl: '', source: 'system-direct', reachable: await probeDirect() };
    } else if (await probeDirect()) {
      value = { mode, resolvedUrl: '', source: 'auto-direct', reachable: true };
    } else {
      const local = await commonLocalCandidates();
      const resolvedUrl = await firstWorkingProxy([...system, ...local]);
      value = { mode, resolvedUrl, source: resolvedUrl ? (system.includes(resolvedUrl) ? 'auto-system' : 'auto-local') : 'auto-unavailable', reachable: Boolean(resolvedUrl) };
    }
  }
  cache = { key, time: Date.now(), value };
  return value;
}

function clearProxyCache() { cache = null; }

module.exports = {
  COMMON_LOCAL_PORTS,
  normalizeProxyValue,
  environmentProxyCandidates,
  systemProxyCandidates,
  probeDirect,
  probeHttpProxy,
  resolveProxy,
  clearProxyCache
};
