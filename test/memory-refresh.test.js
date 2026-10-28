const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../renderer/app.js'), 'utf8');
function functionSource(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, name);
  const tail = source.slice(start + 1);
  const next = tail.search(/^(?:async )?function /m);
  return source.slice(start, next < 0 ? source.length : start + 1 + next);
}

function fixture() {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', innerHTML: '', style: {}, disabled: false, hidden: false,
      classList: { toggle() {}, remove() {} }, setAttribute() {},
      addEventListener(event, handler) { this[event] = handler; },
      querySelector(selector) { return element(selector); },
      replaceChildren() { this.innerHTML = ''; },
      lastElementChild: { textContent: '' }
    });
    return elements.get(id);
  }
  const memoryView = { enabled: true, config: { root: 'D:\\old-memory', exists: true },
    memories: [{ title: 'old', content: 'old', archived: false }], candidates: [{ candidate_id: 'old' }],
    handledCandidateIds: new Set(), query: '', scope: '', archived: false,
    draft: true, editingId: 'unsaved', refreshError: '' };
  const ok = (data) => ({ ok: true, data });
  const api = {
    memoryConfig: async () => ok({ ok: true, config: { root: 'D:\\new-memory', enabled: true, exists: true } }),
    memoryList: async () => ok({ memories: [{ title: 'new', content: 'new', archived: false }] }),
    memoryCandidates: async () => ok({ candidates: [] })
  };
  const context = vm.createContext({ memoryView, api, $: element, $$: () => [],
    MEMORY_MODE_LABELS: { suggest: '建议' }, MEMORY_SCOPE_LABELS: {},
    unwrap(result) { if (!result?.ok) throw new Error(result.error); return result.data; },
    memoryEmptyCard: (title, description) => `${title}:${description}`,
    memoryCardMarkup: (item) => item.title, memoryDraftMarkup: () => 'draft',
    toast() {} });
  for (const name of ['memoryConfigOf', 'memoryRecordsOf', 'memoryEnabledOf', 'memoryErrorText',
    'syncMemoryVisuals', 'syncMemoryDirectoryVisuals', 'handleOpenMemoryFolder', 'refreshMemory',
    'renderMemorySwitches', 'renderMemoryCandidates', 'renderMemoryList']) {
    vm.runInContext(functionSource(name), context);
  }
  return { context, memoryView, api, element, ok };
}

test('failed refresh hides stale data, disables actions, preserves drafts and recovers on retry', async () => {
  const { context, memoryView, api, element } = fixture();
  api.memoryList = async () => { throw new Error('Runtime 已断开'); };
  await context.refreshMemory();
  assert.equal(memoryView.refreshError, 'Runtime 已断开');
  assert.equal(memoryView.config.root, 'D:\\old-memory');
  assert.equal(memoryView.memories[0].title, 'old');
  assert.equal(memoryView.draft, true);
  assert.equal(memoryView.editingId, 'unsaved');
  assert.match(element('#memoryRootPath').textContent, /刷新失败/);
  assert.doesNotMatch(element('#memoryRootPath').textContent, /old-memory/);
  assert.match(element('#memoryListContainer').innerHTML, /旧状态已过期/);
  assert.equal(element('#memoryCandidatesSection').hidden, true);
  assert.equal(element('#memoryEnabledState').textContent, '状态未更新');
  assert.equal(element('#memoryCountBadge').lastElementChild.textContent, '刷新失败 · 状态已过期');
  for (const id of ['#memoryOpenFolderBtn', '#memoryExportBtn', '#memoryImportBtn',
    '#memoryCreateBtn', '#memoryEnabledToggle', '#memoryModeSelectTrigger']) {
    assert.equal(element(id).disabled, true, id);
  }
  assert.equal(element('#memoryPathPill').onclick, null);
  let opens = 0;
  api.openMemoryFolder = async () => { opens++; };
  await context.handleOpenMemoryFolder();
  assert.equal(opens, 0);
  api.memoryList = async () => ({ ok: true, data: { memories: [{ title: 'new', content: 'new' }] } });
  await element('#memoryRetryBtn').click();
  assert.equal(memoryView.refreshError, '');
  assert.equal(memoryView.config.root, 'D:\\new-memory');
  assert.match(element('#memoryRootPath').textContent, /new-memory/);
  assert.equal(element('#memoryOpenFolderBtn').disabled, false);
  assert.equal(element('#memoryImportBtn').disabled, false);
  assert.equal(element('#memoryEnabledToggle').disabled, false);
  assert.equal(element('#memoryListContainer').innerHTML, 'draftnew');
});

test('IPC errors and Runtime errors cannot partially replace the old snapshot', async () => {
  for (const response of [{ ok: false, error: 'IPC 失败' }, { ok: true, data: { ok: false } }]) {
    const { context, memoryView, api } = fixture();
    api.memoryCandidates = async () => response;
    await context.refreshMemory();
    assert.ok(memoryView.refreshError);
    assert.equal(memoryView.config.root, 'D:\\old-memory');
    assert.equal(memoryView.memories[0].title, 'old');
  }
});

test('first-load failure offers retry rather than claiming memory is empty or disabled', async () => {
  const { context, memoryView, api, element } = fixture();
  Object.assign(memoryView, { enabled: false, config: {}, memories: [], candidates: [], draft: false });
  api.memoryConfig = async () => { throw new Error('未连接'); };
  await context.refreshMemory();
  assert.match(element('#memoryListContainer').innerHTML, /记忆刷新失败/);
  assert.equal(typeof element('#memoryRetryBtn').click, 'function');
  assert.equal(element('#memoryOpenFolderBtn').disabled, true);
});
