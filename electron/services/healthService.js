const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { resourcesRoot } = require('../paths');
const { LocalMcpClient } = require('./localMcpClient');

function readSchemaContract() {
  try {
    return JSON.parse(fs.readFileSync(path.join(resourcesRoot(), 'coding-tools-mcp', 'schema-contract.json'), 'utf8'));
  } catch {
    return null;
  }
}

function schemaMatches(expected, runtime) {
  if (!expected || !runtime) return false;
  return String(expected.runtime_version || '') === String(runtime.version || '')
    && Number(expected.schema_version || 0) === Number(runtime.schemaVersion || 0)
    && String(expected.schema_hash || '') === String(runtime.schemaHash || '')
    && Number(expected.tool_count || 0) === Number(runtime.toolCount || 0);
}

function freePort(start, avoid) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > 65535) return reject(new Error('没有找到可用的本地端口。'));
      if (port === avoid) return tryPort(port + 1);
      const server = net.createServer();
      server.once('error', () => tryPort(port + 1));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(port)));
    };
    tryPort(Math.max(1024, Number(start) || 18765));
  });
}

/* 第 29 轮（用户第 7 条「两个 Tunnel 相关的还没有放在一起」+「整个界面都要优化」）：
 *
 * ① 脱敏：Tunnel ID 之前把明文 `tunnel_6a908223...` 直接写进 detail，
 *    而接入指南页同一个标识是遮起来的 —— 同一个值两处待遇不同。
 *    现在 report 层就脱敏，任何消费方（界面、日志、toast）都拿不到明文。
 *    保留前 7 位（tunnel_ 前缀）与末 4 位，够人认出"是不是这一条"。
 *
 * ② 分组：checks 现在带 group 字段。分组的意义由**用户的排查顺序**决定，
 *    不是按技术层次分：出问题时人是从外往里查的 ——
 *    先看"我要连的工作目录对不对"，再看"复现工具在不在"，
 *    最后才看"两个服务起没起来"。
 *    两个 Tunnel 项（客户端文件 / 控制端口）此前被 mcp / mcp-port / mcp-schema
 *    隔开，中间隔着 3 项；现在按 group 归到一起。 */
const CHECK_GROUPS = [
  { id: 'workspace', title: '工作目录', hint: '助手将要读写的那个目录' },
  { id: 'runtime', title: '本地运行环境', hint: '助手自带的 Python 与 Tunnel 程序' },
  { id: 'mcp', title: '本地工具服务（MCP）', hint: 'ChatGPT 调用工具时连的那一端' },
  { id: 'tunnel', title: '连接通道（OpenAI Tunnel）', hint: '把本机端口安全地暴露给 ChatGPT' }
];

function maskSecretId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length <= 12) return '•'.repeat(raw.length);
  return `${raw.slice(0, 7)}${'•'.repeat(12)}${raw.slice(-4)}`;
}

class HealthService {
  constructor({ settings, secrets, environment, orchestrator }) {
    Object.assign(this, { settings, secrets, environment, orchestrator });
  }

  async ownership(current) {
    const runtimeOwned = await this.orchestrator.native.status(current).catch(() => false);
    const tunnelOwned = await this.orchestrator.tunnel.status(current).catch(() => false);
    return { runtimeOwned, tunnelOwned };
  }

  async inspectMcpIdentity(current, runtimeOwned) {
    if (!runtimeOwned) return null;
    if (typeof this.secrets?.get !== 'function') return { skipped: true, reason: '当前凭据存储不支持直接读取 Token。' };
    const token = this.secrets.get('mcpAuthToken');
    if (!token) return { error: '缺少 MCP 本地认证 Token。' };
    try {
      const client = new LocalMcpClient({ port: current.mcpPort, token });
      await client.discoverTools();
      return client.schemaIdentity();
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  async inspect() {
    const current = this.settings.load();
    const env = await this.environment.inspect(current);
    const owned = await this.ownership(current);
    const expectedSchema = readSchemaContract();
    const runtimeSchema = await this.inspectMcpIdentity(current, owned.runtimeOwned);
    const schemaOk = !owned.runtimeOwned || runtimeSchema?.skipped === true || schemaMatches(expectedSchema, runtimeSchema);
    const secretState = this.secrets.status();
    const tunnelId = (typeof this.secrets?.get === 'function' ? this.secrets.get('tunnelId') : '') || current.tunnelId || '';
    const mcpConflict = env.ports.mcpListening && !owned.runtimeOwned;
    const tunnelConflict = env.ports.tunnelListening && !owned.tunnelOwned;
    const checks = [
      /* group 字段驱动界面分组；顺序即显示顺序。
       * 「便携 Python」这个名字用户看不懂（第 7 条原话问"里面的便携 python 是什么"）——
       * "便携"是 portable 的直译，指免安装的绿色版。detail 里直接把这件事说清楚。 */
      { id: 'workspace', group: 'workspace', label: '工作目录', ok: env.workspace.exists, repair: 'choose-workspace', detail: env.workspace.exists ? current.workspace : '所选目录不存在，需要重新选择' },
      { id: 'runtime', group: 'runtime', label: 'Python 运行环境', ok: env.python.installed, repair: 'runtime', detail: env.python.installed ? `${env.python.version} · 助手自带，无需你安装` : '助手自带的 Python 不可用，需要重新安装助手' },
      { id: 'tunnel-client', group: 'tunnel', label: 'Tunnel 客户端程序', ok: env.tunnelClient.installed, repair: '', detail: env.tunnelClient.installed ? '程序文件完整' : '程序文件缺失，需要重新安装助手' },
      { id: 'runtime-key', group: 'mcp', label: 'Runtime API Key', ok: secretState.runtimeApiKey, repair: 'runtime-key', detail: secretState.runtimeApiKey ? '已安全保存' : '尚未填写' },
      // detail 一律给脱敏值：这是体检报告，可能被截图或复制出去（见上方 maskSecretId 说明）。
      { id: 'tunnel-id', group: 'tunnel', label: 'Tunnel ID', ok: Boolean(tunnelId), repair: 'tunnel-id', detail: tunnelId ? `${maskSecretId(tunnelId)}（已加密保存）` : '尚未填写' },
      { id: 'mcp-port', group: 'mcp', label: 'MCP 端口', ok: !mcpConflict, repair: 'port', detail: mcpConflict ? `${current.mcpPort} 被别的程序占用` : `${current.mcpPort} 可用` },
      { id: 'mcp', group: 'mcp', label: 'MCP 服务', ok: owned.runtimeOwned, repair: 'restart', detail: owned.runtimeOwned ? '正在运行' : '尚未启动' },
      {
        id: 'mcp-schema',
        group: 'mcp',
        label: '本地工具定义版本（MCP）',
        ok: schemaOk,
        repair: 'restart',
        detail: !owned.runtimeOwned
          ? 'MCP 启动后自动检查'
          : runtimeSchema?.skipped
            ? '当前环境未执行工具定义一致性检查'
            : runtimeSchema?.error
            ? `无法读取运行版本：${runtimeSchema.error}`
            : schemaOk
              ? `已同步 · Runtime ${runtimeSchema.version} · Schema v${runtimeSchema.schemaVersion} · ${String(runtimeSchema.schemaHash || '').slice(0, 12)} · PID ${runtimeSchema.processId || '—'} · \u5b9e\u4f8b ${String(runtimeSchema.runtimeInstanceId || '').slice(0, 8) || '—'}`
              : `运行中的 MCP 与当前安装包不一致，需要重新部署。当前 Schema v${runtimeSchema?.schemaVersion || 0}，期望 v${expectedSchema?.schema_version || 0}`
      },
      { id: 'tunnel-port', group: 'tunnel', label: 'Tunnel 控制端口', ok: !tunnelConflict, repair: 'port', detail: tunnelConflict ? `${current.healthPort} 被别的程序占用` : `${current.healthPort} 可用` },
      { id: 'tunnel', group: 'tunnel', label: 'Tunnel 服务', ok: owned.tunnelOwned, repair: 'restart', detail: owned.tunnelOwned ? '正在运行' : '尚未启动' }
    ];
    return {
      healthy: checks.every((item) => item.ok),
      checks,
      groups: CHECK_GROUPS,
      settings: current,
      environment: env,
      ownership: owned,
      schemaIdentity: { expected: expectedSchema, runtime: runtimeSchema, matched: schemaOk },
      inspectedAt: new Date().toISOString()
    };
  }

  async repair() {
    let current = this.settings.load();
    const before = await this.inspect();
    const actions = [];
    const unresolved = [];
    const patch = {};
    if (!before.checks.find((item) => item.id === 'mcp-port')?.ok) {
      patch.mcpPort = await freePort(current.mcpPort + 1, current.healthPort);
      actions.push(`MCP 端口已切换为 ${patch.mcpPort}`);
    }
    if (!before.checks.find((item) => item.id === 'tunnel-port')?.ok) {
      patch.healthPort = await freePort(current.healthPort + 1, patch.mcpPort || current.mcpPort);
      actions.push(`Tunnel 控制台端口已切换为 ${patch.healthPort}`);
    }
    if (!this.secrets.status().mcpAuthToken) {
      await this.orchestrator.ensureToken();
      actions.push('已生成 MCP 本地认证 Token');
    }
    if (Object.keys(patch).length) current = this.settings.save(patch);
    if (!current.workspace) unresolved.push('选择工作目录');
    if (!this.secrets.status().runtimeApiKey) unresolved.push('填写 Runtime API Key');
    if (!current.tunnelId) unresolved.push('填写 Tunnel ID');
    if (!before.environment.tunnelClient.installed) unresolved.push('重新安装助手以恢复 Tunnel 客户端');
    if (!before.environment.python.installed) unresolved.push('重新安装助手以恢复自带的 Python 运行环境');
    if (!unresolved.length) {
      await this.orchestrator.restart();
      actions.push('已重新启动 MCP 与 Tunnel');
    }
    const after = await this.inspect();
    return { ...after, actions, unresolved };
  }
}

module.exports = { HealthService, freePort, readSchemaContract, schemaMatches };
