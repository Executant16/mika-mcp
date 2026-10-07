'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('记忆的写操作只挂在桌面通道上，模型通道在运行时被拒绝', () => {
  const server = read('resources/coding-tools-mcp/coding_tools_mcp/server.py');
  const client = read('electron/services/localMcpClient.js');
  const main = read('electron/main.js');
  const preload = read('electron/preload.js');

  // 1. 运行时按来源划分：模型只能读与提议
  assert.match(server, /_MODEL_MEMORY_ACTIONS = frozenset\(\{"list", "search", "get", "bootstrap", "config", "propose"\}\)/);
  assert.match(server, /_DESKTOP_ONLY_MEMORY_ACTIONS = frozenset\(\{/);
  assert.match(server, /origin == "external" and action in _DESKTOP_ONLY_MEMORY_ACTIONS/);
  assert.match(server, /"MEMORY_DESKTOP_ONLY"/);

  // 2. 桌面通道的来源标记就是写操作的唯一凭据
  assert.match(client, /X-Coding-Tools-Origin': 'desktop'/);

  // 3. 记忆必须是"启用后才存在"，而且默认只建议
  const memoryStore = read('resources/coding-tools-mcp/coding_tools_mcp/memory_store.py');
  assert.match(memoryStore, /"Mika" \/ "memory-v1"/);
  assert.match(memoryStore, /"auto_memory": "suggest"/);
  assert.match(server, /def _memory_store\(self, \*, create: bool = False\)/);

  // 4. 注入模型的那块要带信任标签：记忆是数据，不是权限
  assert.match(server, /MEMORY_INSTRUCTION_SCOPE = "local_memory_context"/);
  assert.match(server, /enriched\["memory"\] = block/);

  // 5. 桌面接线：每个动作一条通道，参数映射在 memoryRequests 里
  for (const channel of [
    'memory:config', 'memory:list', 'memory:search', 'memory:candidates', 'memory:confirm',
    'memory:reject', 'memory:create', 'memory:update', 'memory:archive', 'memory:delete',
    'memory:set-config', 'memory:choose-export-path', 'memory:choose-import-path',
    'memory:export', 'memory:import', 'memory:revisions', 'memory:restore-revision',
    'memory:rebuild-index', 'memory:open-folder'
  ]) {
    assert.match(main, new RegExp(`secureHandle\\('${channel}'`), `缺少 IPC 通道 ${channel}`);
  }
  assert.match(main, /require\('\.\/services\/memoryRequests'\)/);
  assert.match(main, /shell\.openPath/);

  // 6. 渲染层只能透传，拿不到写盘能力
  for (const bridge of [
    'memoryConfig', 'memoryList', 'memorySearch', 'memoryCandidates', 'memoryConfirm',
    'memoryReject', 'memoryCreate', 'memoryUpdate', 'memoryArchive', 'memoryDelete',
    'memorySetConfig', 'memoryExport', 'memoryImport', 'memoryRevisions',
    'memoryRestoreRevision', 'memoryRebuildIndex', 'openMemoryFolder',
    'memoryChooseExportPath', 'memoryChooseImportPath'
  ]) {
    assert.match(preload, new RegExp(`${bridge}:`), `preload 缺少 ${bridge}`);
  }
});

test('记忆不进工作区：路径与隐私开关都写在运行时侧', () => {
  const server = read('resources/coding-tools-mcp/coding_tools_mcp/server.py');
  // 手改 Markdown 绕过检查时，出口打码是最后一道防线
  assert.match(server, /redact_model_payload\(payload\)/);
  // 隐私开关只从配置读，不认模型参数
  assert.match(server, /allow_sensitive_personal=settings\["allow_sensitive_personal"\]/);
  assert.match(server, /inspect_memory_safety\(/);
});