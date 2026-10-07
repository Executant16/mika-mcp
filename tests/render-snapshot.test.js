const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `app.js 应包含 ${name}`);
  const paramsEnd = source.indexOf(')', source.indexOf('(', start));
  const bodyStart = source.indexOf('{', paramsEnd);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  assert.fail(`${name} 的函数体花括号未闭合`);
}

function makeElement(id) {
  return {
    id,
    textContent: '',
    innerHTML: '',
    className: '',
    hidden: false,
    style: {},
    dataset: {},
    placeholder: ''
  };
}

test('renderSnapshot preserves the authoritative workspace snapshot while updating the UI', () => {
  const source = read('renderer/app.js');
  const renderSnapshot = extractFunction(source, 'renderSnapshot');
  const elements = new Map();
  const calls = {
    applyFormValues: [],
    authorizedRoots: [],
    workspaceManagement: [],
    overviewWorkspace: [],
    migration: [],
    dots: [],
    collaborators: []
  };
  const $ = (selector) => {
    const id = String(selector).startsWith('#') ? String(selector).slice(1) : String(selector);
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  const snapshot = {
    settings: {
      workspace: 'D:\\Projects\\mika-demo',
      authorizedRoots: ['D:\\Projects\\mika-demo', 'D:\\Projects\\shared-assets'],
      mcpPort: 18765,
      tunnelId: 'tunnel_authoritative_123',
      developerMode: false
    },
    secrets: { runtimeApiKey: 'runtime-secret-value' },
    environment: {
      python: { installed: true, version: '3.12.10' },
      workspace: { exists: true }
    },
    status: {
      fullyReady: true,
      runtimeRunning: true,
      tunnelRunning: true,
      localMcpUrl: 'http://127.0.0.1:18765/mcp'
    },
    appVersion: '0.1.0'
  };
  const before = structuredClone(snapshot);
  const state = { lastTaskPayload: null };
  const context = {
    state,
    $,
    applyFormValues: (...args) => calls.applyFormValues.push(args),
    renderMigrationNotice: (settings) => calls.migration.push(settings),
    extractWorkspaceName: (workspace) => path.basename(workspace),
    setDot: (element, value) => {
      calls.dots.push([element?.id, value]);
      if (element) element.className = value;
    },
    renderAuthorizedRoots: (roots) => calls.authorizedRoots.push(roots),
    renderWorkspaceManagement: (settings) => calls.workspaceManagement.push(settings),
    renderOverviewWorkspace: (value) => calls.overviewWorkspace.push(value),
    updateChatGptAuthStatusVisual: () => calls.collaborators.push('auth'),
    maskTunnelId: (value) => `masked:${value}`,
    renderTunnelIdDisplay: () => calls.collaborators.push('tunnel-display'),
    renderEnvironment: (environment) => calls.collaborators.push(['environment', environment]),
    renderDeploySummary: () => calls.collaborators.push('deploy-summary'),
    renderAppInfo: (value) => calls.collaborators.push(['app-info', value]),
    renderOverviewConfig: (value) => calls.collaborators.push(['overview-config', value]),
    renderOverviewIssues: (value) => calls.collaborators.push(['overview-issues', value]),
    renderOverviewServices: (value) => calls.collaborators.push(['overview-services', value]),
    updateGlobalStatusPopover: (value) => calls.collaborators.push(['global-status', value])
  };
  const render = vm.runInNewContext(`(${renderSnapshot})`, context);

  render(snapshot, { forceForms: true });

  assert.strictEqual(state.snapshot, snapshot, '状态应保存权威快照对象本身');
  assert.equal(state.selectedWorkspace, snapshot.settings.workspace);
  assert.deepEqual(calls.applyFormValues, [[snapshot, true]]);
  assert.deepEqual(calls.authorizedRoots, [snapshot.settings.authorizedRoots],
    '授权目录应按快照原值交给渲染协作函数');
  assert.deepEqual(calls.workspaceManagement, [snapshot.settings]);
  assert.ok(calls.overviewWorkspace.length > 0, '总览工作区应随快照更新');
  assert.ok(calls.overviewWorkspace.every((value) => value === snapshot));
  assert.deepEqual(calls.migration, [snapshot.settings]);

  assert.equal(elements.get('sideRuntimeText').textContent, '服务已就绪');
  assert.equal(elements.get('runtimeStatus').textContent, '环境就绪');
  assert.equal(elements.get('mcpStatus').textContent, '正常运行');
  assert.equal(elements.get('tunnelStatus').textContent, '已连接');
  assert.equal(elements.get('selectedWorkspace').textContent, snapshot.settings.workspace);
  assert.equal(elements.get('guideLocalUrl').textContent, snapshot.status.localMcpUrl);
  assert.equal(elements.get('guideTunnelId').dataset.rawValue, snapshot.settings.tunnelId,
    'Tunnel ID 真值应保留在数据属性供脱敏显示函数使用');
  assert.equal(elements.get('topStartButton').textContent, '重新部署');
  assert.equal(elements.get('settingsKeyState').textContent, '已加密保存');

  assert.deepEqual(snapshot, before,
    '渲染快照不得擅自删除或改写工作区、授权目录和其他权威值');
});
