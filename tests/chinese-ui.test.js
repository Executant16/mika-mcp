const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('chat toolbar uses Chinese-first service labels', () => {
  const html = read('renderer/browser.html');
  const js = read('renderer/browser.js');
  assert.match(html, />本地工具<\/span>/);
  assert.match(html, /id="connectionStateLabel">连接通道/);
  assert.match(js, /等待模型继续处理/);
  assert.doesNotMatch(html, /<span id="mcpState"><i><\/i>MCP<\/span>/);
});

test('manager primary navigation and section headings are Chinese-first', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  for (const english of ['CONTROL CENTER', 'RUNTIME & CONNECTION', 'WORKSPACE ACCESS', 'TASK STATE', 'BUILD & VERIFY', 'DIAGNOSE & REPAIR', 'SETUP GUIDE', 'DIAGNOSTICS', 'PREFERENCES', 'CURRENT OBJECTIVE', 'RESUMABLE TASK']) {
    assert.doesNotMatch(html, new RegExp(english.replace(/[&]/g, '\\&')));
    assert.doesNotMatch(app, new RegExp(english.replace(/[&]/g, '\\&')));
  }
  assert.match(app, /function statusLabel/);
  assert.match(app, /等待你处理/);
  assert.match(app, /function toolLabel/);
});

test('settings keep common options visible and move maintenance controls behind advanced disclosure', () => {
  const html = read('renderer/index.html');
  /* ★ 保留的原意图（第 28 轮「常用项留在上面、维护与高门槛项收进高级设置区」）。
   *   这一版把文案整体重写了，但三条契约没变：
   *   ① 维护项仍然收在**同一个**「高级设置」区里（标题由「高级设置与维护」
   *      缩为「高级设置」，锚点 id #settingsAdvancedAccordion 仍在）；
   *   ② 设置项标题由「运行通道密钥（Runtime API Key）」改成
   *      「通道密钥 (Runtime API Key)」—— 同一个东西，只是改名；
   *   ③ 两条已删除的通知 id 不得复活。
   *   另外把"常用项在上"从"标题顺序"变成**结构性断言**：
   *   常用项既要在高级设置区之前，也不许被折叠进 <details>。 */
  const settingsStart = html.indexOf('data-page-view="settings"');
  const nextPage = html.indexOf('data-page-view="advanced"');
  const settingsPage = settingsStart >= 0
    ? html.slice(settingsStart, nextPage > settingsStart ? nextPage : undefined)
    : '';
  assert.ok(settingsPage, '应能截出「偏好设置」页');
  const advancedAt = settingsPage.indexOf('id="settingsAdvancedAccordion"');
  assert.ok(advancedAt >= 0, '维护项应仍收在「高级设置」区（#settingsAdvancedAccordion）里');
  assert.match(settingsPage, /高级设置/);
  assert.match(settingsPage,
    /<span class="advanced-row-title">通道密钥 \(Runtime API Key\)<\/span>/,
    '★ 保留的原意图：运行通道密钥这一项仍在高级设置区（文案由'
    + '「运行通道密钥（Runtime API Key）」改为「通道密钥 (Runtime API Key)」）；'
    + '判据必须钉到 advanced-row-title 这一行 —— 危险操作区那行「删除通道密钥 (Runtime API Key)」'
    + '会命中同一个短语，只用短语会让这条断言变成假绿');
  const commonRegion = settingsPage.slice(0, advancedAt);
  for (const heading of ['界面外观', '启动与运行', '任务反馈']) {
    const at = settingsPage.indexOf(`<h3>${heading}</h3>`);
    assert.ok(at >= 0 && at < advancedAt,
      `★ 保留的原意图：常用项「${heading}」必须仍在高级设置区**之前**、直接可见`);
  }
  const notificationsAt = settingsPage.indexOf('id="taskNotificationsToggle"');
  assert.ok(notificationsAt >= 0 && notificationsAt < advancedAt,
    '★ 保留的原意图：常用项（桌面任务提醒开关）必须仍直接可见，且在高级设置区**之前**');
  assert.doesNotMatch(commonRegion, /<details/,
    '★ 常用项必须仍然直接可见，不得被折叠进 <details>（要折叠的是维护项，不是常用项）');
  assert.doesNotMatch(html, /id="taskNotificationOnlyWhenUnfocusedToggle"/);
  assert.doesNotMatch(html, /id="taskNotificationMinSecondsSelect"/);
});

test('build verification defaults to an automatic plan with manual overrides folded away', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  /* ★ 保留的原意图（第 28 轮：「无需手填就该有可自动执行的方案」+
   *   「能力不许随页面搬迁一起消失」）。
   *   这一版把构建配置整体搬进了「偏好设置 → 高级设置」里的三张 h4 卡片，
   *   文案与标题全换了：<h3>构建与验证</h3> → <h4>构建与测试策略</h4>、
   *   「自动选择」→「自动检测」/「留空则系统自动推断」、
   *   结论文案「不会盲目执行」被删。契约本身没变，只是换了落点与写法：
   *   ① 默认值必须说得出"系统会自动推断"，而不是留空让用户自己猜；
   *   ② 没有可用测试时要说清结论，而不是"悄悄跑一遍"；
   *   ③ 能力落点（build* id）不许随搬迁一起消失。 */
  /* ★ 第 45 轮重锚：界面重写把构建配置从「高级设置里的三张 h4 卡片」
   *   搬到了偏好设置页的**独立「项目」分页**，卡片锚点随之从
   *   `<h4 class="advanced-block-title">构建与测试策略</h4>` 变成
   *   `<h3>项目构建与策略</h3>`。要守的性质没变 —— 构建配置必须有一张
   *   自己的卡片作为落点，不能散成裸表单。 */
  assert.match(html, /<h3>项目构建与策略<\/h3>/,
    '构建配置现在锚在这张卡片上（原判据是任务页的 <h3>构建与验证</h3>，'
    + '中途一度锚在 <h4 class="advanced-block-title">构建与测试策略</h4>）');
  assert.match(html, /留空则系统自动推断/,
    '★ 保留的原意图：不用手填，留空就走自动方案（原判据是「自动选择」）');
  assert.match(html, /id="buildPlanBuild">自动检测</,
    '★ 构建方案的默认文案必须是「自动检测」');
  assert.match(html, /id="buildPlanTest">未检测到可用测试</,
    '★ 没有可用测试时要说清结论（原判据是「不会盲目执行」这句结论）');
  assert.match(app, /project\?\.buildCommand \|\| '自动检测'/,
    '★ 运行时回落也必须保持"没有自定义命令 → 自动检测"，不能被空值冲成空白');
  assert.match(app, /project\?\.testCommand \|\| '未检测到可用测试'/);
  assert.match(app, /自动检查项目产物/, '产物目录的默认值同样要说得出"自动"');
  assert.match(app, /function applyBuildProject/);
  assert.match(app, /buildPlanTest/);

  /* 搬迁必须是真的搬迁：侧栏不再有这一项、HTML 不再有独立的 build 页，
   * 但能力（四个 build* id）仍然存在。 */
  const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(htmlNoComments, /data-page="build"/, '侧栏不应再有独立的「构建验证」导航项');
  assert.doesNotMatch(htmlNoComments, /data-page-view="build"/, '不应再有独立的 build 页区块');
  // 能力仍在（从"独立页"变成"高级设置里的一张卡片"），所以这四个 id 必须还在。
  for (const id of ['buildPlanProject', 'buildPlanTest', 'buildConsole', 'buildReport']) {
    assert.match(htmlNoComments, new RegExp(`id="${id}"`), `${id} 是搬迁后的能力落点，不能连内容一起删掉`);
  }
});

test('task center exposes Chinese-first safe isolation controls without a merge action', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  const browser = read('renderer/browser.js');
  assert.match(html, /安全隔离区/);
  assert.match(html, /id="taskIsolationBadge"/);
  assert.match(app, /function renderTaskIsolation/);
  assert.match(app, /查看差异/);
  assert.match(app, /应用到主工作区/);
  assert.match(app, /不会改变 Git 暂存区/);
  assert.match(app, /主工作区存在同文件的新修改，系统已拒绝写入，没有覆盖你的内容/);
  assert.match(app, /放弃隔离任务/);
  assert.match(browser, /安全隔离中/);
  assert.doesNotMatch(html, /<button[^>]*>[^<]*合并[^<]*<\/button>/);
});
