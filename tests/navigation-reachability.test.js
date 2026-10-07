const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
/* 断言前一律剥注释：本仓库的注释经常逐字引用被删掉的旧代码，
 * 不剥的话会命中自己的说明文档（这个坑本轮已栽过多次）。 */
const strip = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

/* ★ 第 45 轮：`logs` 从这张表里移除。
 *   第 41 轮删掉 workspace / logs / advanced 三个空壳页时，logs 被并入 health，
 *   于是它被登记成"旧页面名"。但界面重写又把「运行日志」恢复成了一个**真实页面**
 *   （`data-page-view="logs"` + 侧栏 data-page="logs" + pageMeta.logs 三处齐全），
 *   而且 navigate() 里并没有 logs 的重定向 —— 点击「运行日志」能正常落到该页。
 *   这时再把它留在 LEGACY_PAGES 里就有两个后果：
 *     ① 下面第 5 条会断言"logs 不应出现在 pageMeta 里"，与事实相反；
 *     ② 第 3 条会要求 navigate 里存在 `page === 'logs'` 分支 ——
 *        真去补这个分支反而会把「运行日志」重定向走，制造一个真 bug。
 *   判据要守的性质没变：**已删除页面的旧名不得留在 pageMeta 里**；
 *   只是 logs 已不再是"已删除页面"。 */
const LEGACY_PAGES = { workspace: 'deploy', advanced: 'settings' };

test('every way into the settings surface still lands on a page that exists', () => {
  /* 第 41 轮：workspace / logs / advanced 三个空壳页面被删除。
   *
   * 删页面本身很容易做对，难的是**把通向它们的入口一起照顾到** ——
   * 本轮就真的漏了一个，而且是"点了没反应"这种最难被发现的形态：
   *   ① ChatGPT 工具条的「管理工作区…」走
   *      browser.js → browserPreload.js(api.openSettings) → main.js('manager:open')
   *      → settingsView('settings:navigate') → app.js(onNavigate) → navigate()
   *   ② 而 app.js 的 onNavigate 当时还写着 `if (pageMeta[targetPage]) navigate(...)`
   *      —— pageMeta 里已经没有 workspace 这个键，于是主进程传过来的旧页面名
   *      被**静默丢掉**：窗口打开了，却停在原来那一页。
   *
   * 这条测试守的就是整条链路，而不是只看一端：
   *   链路必须完整（少一环 = 入口死掉），且**旧页面名必须仍然可达**
   *   （由 navigate 的重定向负责，它是唯一的收口）。
   *   最后一条是通用护栏：任何导航字面量都必须是"真实页面或已登记的旧名"，
   *   将来再删页面时，漏改的入口会在这里直接红，而不是靠用户点一下才发现。 */
  const browser = strip(read('renderer/browser.js'));
  const browserPreload = strip(read('electron/browserPreload.js'));
  const main = strip(read('electron/main.js'));
  const preload = strip(read('electron/preload.js'));
  const app = strip(read('renderer/app.js'));
  const html = strip(read('renderer/index.html'));

  /* 1) 链路完整：ChatGPT 工具条的入口 → 主进程 → 设置渲染进程 → 收口函数。
   *    少任何一环，用户点「管理工作区…」都不会有任何反应。 */
  assert.match(browser, /api\.openSettings\('workspace'\)/,
    '★ ChatGPT 工具条的「管理工作区…」必须仍然打开设置界面（它现在落在「连接与文件」页的工作区与权限区块）');
  assert.match(browserPreload, /openSettings: \(page\) => ipcRenderer\.invoke\('manager:open', page\)/,
    '★ 工具栏 preload 必须把页面名透传给主进程');
  assert.match(main, /secureHandle\('manager:open'[\s\S]{0,160}?openSettingsSurface\(targetPage\)/,
    '★ 主进程必须把 manager:open 的页面名交给 openSettingsSurface');
  assert.match(main, /webContents\.send\('settings:navigate', initialPage\)/,
    '★ openSettingsSurface 必须真的把页面名送进设置渲染进程 —— 只 show() 窗口不算导航');
  assert.match(preload, /ipcRenderer\.on\('settings:navigate'/,
    '★ 设置渲染进程必须订阅 settings:navigate，否则主进程发的页面名没人接');

  /* 2) 收口处不得按 pageMeta 预过滤（那正是本轮的真缺陷）。 */
  assert.match(app, /api\.onNavigate\?\.\(\(targetPage\) => navigate\(targetPage\)\);/,
    '★ onNavigate 必须把页面名直接交给 navigate —— 用 pageMeta 预过滤会静默丢掉旧页面名');

  /* 3) 旧名重定向必须仍在（放开过滤的前提是 navigate 认得这些名字，
   *    否则就是把"没反应"换成了"白页"）。目标页也必须真的存在。 */
  for (const [legacy, target] of Object.entries(LEGACY_PAGES)) {
    assert.match(app, new RegExp(`page === '${legacy}'`),
      `★ navigate 必须还认得旧页面名 ${legacy}（重定向到 ${target}）`);
    assert.match(html, new RegExp(`data-page-view="${target}"`),
      `★ 旧名 ${legacy} 的重定向目标 ${target} 必须是真实存在的页面块`);
  }

  /* 4) 通用护栏：所有**字面量**导航目标都必须是"真实页面或已登记的旧名"。
   *    变量形式的（navigate(button.dataset.page) 这类）不在此列 ——
   *    它们的取值来自 markup，由"pageMeta == data-page-view"那条护栏守着。 */
  const metaBody = app.match(/const pageMeta = \{([\s\S]*?)\n\};/)?.[1] || '';
  const pages = new Set([...metaBody.matchAll(/^\s*([a-z][a-z0-9-]*):/gm)].map((m) => m[1]));
  assert.ok(pages.size > 0, '应能从 app.js 读出 pageMeta 的页面集合');
  const known = new Set([...pages, ...Object.keys(LEGACY_PAGES)]);

  const callsites = [
    ...[...browser.matchAll(/api\.openSettings\('([^']+)'\)/g)].map((m) => ['browser.js', m[1]]),
    ...[...app.matchAll(/navigate\('([^']+)'\)/g)].map((m) => ['app.js', m[1]]),
    ...[...main.matchAll(/openSettingsSurface\('([^']+)'\)/g)].map((m) => ['electron/main.js', m[1]])
  ];
  assert.ok(callsites.length >= 6, `应至少找到 6 处字面量导航入口（实测 ${callsites.length} 处）`);
  for (const [file, page] of callsites) {
    assert.ok(known.has(page),
      `★ ${file} 里的导航目标 '${page}' 既不是真实页面、也不是已登记的旧页面名 —— `
      + '删改页面时漏改的入口会表现为"点了没反应"');
  }

  /* 5) 反向：已登记的旧名必须在 pageMeta 里**不存在**（登记就该撤掉键，
   *    两边都留会让"旧名重定向"看起来像正常页面，掩盖真正的残留）。 */
  for (const legacy of Object.keys(LEGACY_PAGES)) {
    assert.equal(pages.has(legacy), false,
      `★ ${legacy} 是已删除的页面，不应再出现在 pageMeta 里`);
  }
});