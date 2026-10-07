'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MEMORY_TYPES,
  memoryListArgs,
  memorySearchArgs,
  memoryCreateArgs,
  memoryUpdateArgs,
  memorySetConfigArgs,
  memoryConfirmArgs,
  memoryRejectArgs,
  memoryIdArgs,
  memoryRestoreRevisionArgs,
  memoryExportArgs,
  memoryImportArgs
} = require('../electron/services/memoryRequests');

test('列表参数默认看全部范围并要完整记录', () => {
  assert.deepEqual(memoryListArgs(), { action: 'list', scope: '', limit: 50, archived: false, detail: 'full' });
  assert.equal(memoryListArgs({ scope: 'PROJECT' }).scope, 'project');
  assert.equal(memoryListArgs({ scope: '乱填' }).scope, '', '非法范围要退回"全部"，不能原样发给运行时');
  assert.equal(memoryListArgs({ archived: true }).archived, true);
});

test('搜索参数只带查询与上限', () => {
  assert.deepEqual(memorySearchArgs({ query: ' 安装包 ' }), { action: 'search', query: '安装包', limit: 50, detail: 'full' });
});

test('新建：默认本项目 + note，内容不做 trim（Markdown 允许缩进）', () => {
  const args = memoryCreateArgs({ title: ' 标题 ', content: '  第一行\n第二行  ' });
  assert.equal(args.scope, 'project');
  assert.equal(args.memory_type, 'note');
  assert.equal(args.title, '标题');
  assert.equal(args.content, '  第一行\n第二行  ');
});

test('新建：非法类型退回 note，pinned 只认布尔真', () => {
  assert.equal(memoryCreateArgs({ memoryType: '不是类型' }).memory_type, 'note');
  assert.equal(memoryCreateArgs({ pinned: 'yes' }).pinned, false);
  assert.equal(memoryCreateArgs({ pinned: true }).pinned, true);
});

test('更新：没给的字段绝不发出去（发空标题会把标题清掉）', () => {
  const args = memoryUpdateArgs({ memoryId: 'mem_abc', content: '只改内容' });
  assert.deepEqual(Object.keys(args).sort(), ['action', 'content', 'memory_id']);
});

test('更新：显式给空字符串才真的清空', () => {
  assert.equal(memoryUpdateArgs({ memoryId: 'mem_abc', title: '' }).title, '');
});

test('更新：驼峰与下划线两种写法都认', () => {
  assert.equal(memoryUpdateArgs({ memory_id: 'mem_x', memory_type: 'decision' }).memory_type, 'decision');
});

test('开关：关闭必须能真的关掉（false 不能被默认值吞掉）', () => {
  assert.deepEqual(memorySetConfigArgs({ enabled: false }), { action: 'set_config', enabled: false });
  assert.deepEqual(memorySetConfigArgs({ allowSensitivePersonal: false }), { action: 'set_config', allow_sensitive_personal: false });
  assert.deepEqual(memorySetConfigArgs({}), { action: 'set_config' }, '没给开关就什么都不改');
});

test('开关：模式只接受三种取值', () => {
  assert.equal(memorySetConfigArgs({ autoMemory: 'AUTO' }).auto_memory, 'auto');
  assert.equal(memorySetConfigArgs({ autoMemory: '乱填' }).auto_memory, 'suggest');
});

test('建议的确认与拒绝', () => {
  assert.deepEqual(memoryConfirmArgs({ candidateId: 'cand_1', reason: '对' }), { action: 'confirm', candidate_id: 'cand_1', reason: '对' });
  assert.deepEqual(memoryRejectArgs('cand_2'), { action: 'reject', candidate_id: 'cand_2' });
});

test('按 id 操作与修订恢复', () => {
  assert.deepEqual(memoryIdArgs('archive', 'mem_1'), { action: 'archive', memory_id: 'mem_1' });
  assert.deepEqual(memoryRestoreRevisionArgs({ memoryId: 'mem_1', revision: 3 }), { action: 'restore_revision', memory_id: 'mem_1', revision: 3 });
  assert.equal(memoryRestoreRevisionArgs({ memoryId: 'mem_1', revision: 0 }).revision, 1, '修订号至少为 1');
});

test('导出与导入路径', () => {
  assert.deepEqual(memoryExportArgs(''), { action: 'export', path: '' });
  assert.deepEqual(memoryImportArgs(' D:\\备份\\a.zip '), { action: 'import', path: 'D:\\备份\\a.zip' });
});

test('类型与范围清单和运行时 schema 保持一致', () => {
  const server = fs.readFileSync(
    path.resolve(__dirname, '../resources/coding-tools-mcp/coding_tools_mcp/server.py'),
    'utf8'
  );
  for (const type of MEMORY_TYPES) {
    assert.match(server, new RegExp(`"${type}"`), `运行时 schema 缺少类型 ${type}`);
  }
  for (const scope of ['global', 'project', 'task']) {
    assert.match(server, new RegExp(`"${scope}"`), `运行时 schema 缺少范围 ${scope}`);
  }
});