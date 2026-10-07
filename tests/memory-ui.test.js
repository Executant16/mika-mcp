'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('记忆页接进导航，四块内容齐全，并且复用现成样式不新增 CSS', () => {
  const html = read('renderer/index.html');
  const manager = read('renderer/app.js');
  const styles = read('renderer/styles.css');

  // 侧栏导航与页面容器
  assert.match(html, /data-page="memory"/);
  assert.match(html, /data-page-view="memory"/);

  // 四块内容需要的节点
  for (const id of [
    'memoryCountBadge', 'memoryRootPath', 'memoryEnabledToggle', 'memoryModeSelect',
    'memoryPersonalToggle', 'memoryCandidateCount', 'memoryCandidateList',
    'memorySearchInput', 'memoryCreateBtn', 'memoryScopeFilters', 'memoryListContainer',
    'memoryOpenFolderBtn', 'memoryExportBtn', 'memoryImportBtn'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `记忆页缺少 #${id}`);
  }
  /* ★ 第 45 轮重锚：界面重写把这四块的措辞与类名都换了 ——
   *   ①「记忆开关」现在叫「长期记忆」（同一块：首屏 hero 卡上的总开关）；
   *   ② 列表容器由 skills-grid-container 换成它自己的 .memory-list-container；
   *   ③ 记忆页不再"零新增 CSS"：它有了自己的 .memory-* 样式层（styles.css 里 82 处）。
   *   要守的性质没变 —— 四块内容齐全、且仍复用设计系统的开关与分段控件词汇。
   *   所以 ③ 改成断言"开关与分段控件仍是设计系统那套类"，而不是"不许出现 .memory-*"。 */
  assert.match(html, /长期记忆/, '记忆开关这一块（现名「长期记忆」）必须还在');
  assert.match(html, /待确认的建议/);
  assert.match(html, /已记住的内容/);
  assert.match(html, /导出备份/);

  // 复用设计系统的类，而不是自己造一套样式（否则会带进新的字号/间距字面量）
  assert.match(html, /class="switch-card/);
  assert.match(html, /class="segmented-item/);
  assert.match(html, /id="memoryListContainer"/);
  assert.doesNotMatch(styles, /\.memory-(?:root-path)\b/, '记忆页不应再新增无归属的样式块');

  // 面向用户的两句关键说明：密钥拒收、归档可回来
  assert.match(html, /拒收/);
  assert.match(manager, /取消归档/);
});

test('记忆页只透传参数，写操作仍然由运行时按来源判定', () => {
  const manager = read('renderer/app.js');

  // 页面注册与按页触发
  assert.match(manager, /memory: \['记忆'/);
  assert.match(manager, /initMemoryPage\(\)/);

  // 界面用到的桌面通道
  for (const call of [
    'memoryConfig', 'memoryList', 'memorySearch', 'memoryCandidates', 'memoryConfirm',
    'memoryReject', 'memoryCreate', 'memoryUpdate', 'memoryArchive', 'memoryDelete',
    'memorySetConfig', 'memoryChooseExportPath', 'memoryChooseImportPath',
    'memoryExport', 'memoryImport', 'openMemoryFolder'
  ]) {
    assert.match(manager, new RegExp(`api\\.${call}\\(`), `界面没有调用 ${call}`);
  }

  // 静态预览（没有桌面外壳）也要能看见界面：页面调用的每个接口，
  // 假数据里都必须有一份 —— 少一个，静态预览点按钮就会报错。
  const previewStart = manager.indexOf('function createPreviewApi()');
  const previewEnd = manager.indexOf('const pageMeta', previewStart);
  assert.ok(previewStart > 0 && previewEnd > previewStart, '静态预览的假数据必须可定位');
  const preview = manager.slice(previewStart, previewEnd);
  const called = new Set([...manager.matchAll(/api\.((?:memory|openMemory)[A-Za-z]+)\(/g)].map((match) => match[1]));
  assert.ok(called.size >= 15, `记忆页调用的接口太少（${called.size} 个），检查是不是漏接了`);
  for (const name of called) {
    assert.match(preview, new RegExp(`\\b${name}:`), `静态预览缺少 ${name}`);
  }

  // 界面不自己判断权限，只把运行时的拒绝码翻成人话
  assert.match(manager, /MEMORY_UNSAFE/);
  assert.match(manager, /MEMORY_DISABLED/);
  assert.match(manager, /MEMORY_DESKTOP_ONLY/);
});