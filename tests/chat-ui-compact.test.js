const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

/* 第 32 轮新增：browser.js 的读取辅助。
   * 本条以上的测试都各自 read('renderer/browser.js')，但第 32 轮新增的三条
   * 测试都要对 JS 做好几处断言，逐处 read 既啰嗦又容易与 HTML/CSS 的变量混淆。 */
const js_ = () => read('renderer/browser.js');

test('top chrome keeps its height contract, and every removed control still has a surviving entry point', () => {
  const browserCss = read('renderer/browser.css');
  const browserHtml = read('renderer/browser.html');
  const main = read('electron/main.js');
  /* 第 24 轮把工具栏高度收敛成单一来源。
   *
   * 背景：112 这个数字曾被抄成 5 份（browser.css 2 处、main.js 1 处、
   * chatViewController 默认值 1 处、本测试 1 处），其中 chatViewController
   * 那份写错成 64、browser.css 的 calc 那份在第 22 轮"提取常量"时漏改。
   * 只断言"某处等于 112"挡不住这种漂移 —— 得断言**几处彼此相等**：
   *   CSS 变量 --toolbar-height 是渲染层的真身，
   *   main.js 的 CHAT_TOOLBAR_HEIGHT 是主进程的真身（CSS 变量跨不进主进程），
   *   chatViewController 的默认值必须与之一致（不能是 64），
   *   且 CSS 里两处用高度的规则都必须引用变量而不是字面量。 */
  const cssHeight = browserCss.match(/--toolbar-height:\s*(\d+)px/)?.[1];
  assert.ok(cssHeight, 'browser.css 必须定义 --toolbar-height');
  assert.match(browserCss, /\.browser-toolbar\{[^}]*height:var\(--toolbar-height\)/,
    '工具栏高度必须引用变量，不得再写字面量');
  assert.match(browserCss, /\.loading-stage\{[^}]*height:calc\(100% - var\(--toolbar-height\)\)/,
    '占位高度必须引用同一变量（此处曾经漏改成字面量）');
  const mainHeight = main.match(/const CHAT_TOOLBAR_HEIGHT = (\d+);/)?.[1];
  assert.equal(mainHeight, cssHeight, '主进程常量必须与 CSS 变量相等');
  assert.match(main, /toolbarHeight:\s*CHAT_TOOLBAR_HEIGHT/);
  const controllerDefault = read('electron/chatViewController.js').match(/toolbarHeight = (\d+)/)?.[1];
  assert.equal(controllerDefault, cssHeight, 'ChatGPT 视图的兜底默认值必须与真实高度一致（曾是 64）');
  assert.match(browserCss, /\.workspace-health-popover\{position:absolute/);
  assert.match(browserHtml, /id="workspaceHealthPopover"/);
  assert.match(browserHtml, /id="addWorkspace"/);

  /* 第 26 轮：工具栏「＋ 授权目录」被移除（与设置页「额外授权目录」面板重复），
   * 所以不能再断言它存在 —— 但**不能让这个能力整体消失**。
   * 真正要守的是"两个入口里至少活一个"，而不是"工具栏上必须有这个 id"。
   * 这才是这条测试原本想保护的用户价值：用户必须能找到授权额外目录的地方。 */
  const toolbarQuick = browserHtml.includes('id="addAuthorizedRootQuick"');
  const settingsPage = read('renderer/index.html');
  const settingsEntry = settingsPage.includes('id="addAuthorizedRoot"') && settingsPage.includes('id="authorizedRootsList"');
  assert.ok(settingsEntry, '设置页必须保留「额外授权目录」面板（这是移除工具栏入口的前提）');
  assert.ok(toolbarQuick || settingsEntry, '授权额外目录的入口不能两处都消失');
  // 工具栏那个是重复入口，应当已删；若有人加回来，这里会提醒重新评估去重决策。
  assert.doesNotMatch(browserHtml, /id="addAuthorizedRootQuick"/,
    '工具栏「＋ 授权目录」已因与设置页重复而移除，不要加回');

  /* 第 26 轮：状态点收拢。
   * #workspaceHealthButton（22px 独立按钮）降级为 .workspace-label 内的视觉小圆点，
   * 判据（activeWorkspace && mcpRunning）与上排 #mcpState 同源，属于重复绘制。
   * 弹层能力必须保留，只是点击目标从"小圆点"变成"整块工作区标签"。
   *
   * ★ 第 32 轮：那块「当前 xxx」标签并进了工作区切换器按钮（它的点击现在
   *   被"开工作区菜单"占用），所以同步详情需要一个新的落点 —— 它变成了
   *   一个 16px 的幽灵按钮（圆点由 ::before 画，不额外占位）。
   *   这里断言两件事：能力仍在（可点的 #workspaceHealthDot + 弹层元素），
   *   且它不再是第 26 轮删掉的那个 22px 实体按钮（id 不同，说明是重做的）。 */
  assert.match(browserHtml, /id="workspaceHealthDot"/, '小圆点应保留为同步状态的落点');
  assert.doesNotMatch(browserHtml, /id="workspaceHealthButton"/, '不应再有 22px 的独立状态按钮');
  assert.match(browserHtml, /id="workspaceHealthDot"[^>]*aria-label=/,
    '它现在是纯图标按钮，必须有自己的可读名字（aria-label）');
  const triggerTag = browserHtml.match(/<button id="workspaceTrigger"[^>]*>/)?.[0] || '';
  assert.match(triggerTag, /aria-haspopup="true"/,
    '工作区切换器必须声明它开一个菜单（第 32 轮把「切换工作区」文本标签、下拉、添加按钮合并到它身上）');
  assert.match(triggerTag, /aria-expanded="false"/,
    '切换器的展开态必须由 aria-expanded 承载，而不是靠一个 CSS 类（browser.js 会同步它）');

  /* ★ 顶栏在界面重写后回到了**单行 64px**（原先"40 + 36 两行"的形态已取消），
   * 所以这里删掉了 `mainRow + barRow === --toolbar-height` 那条加法断言：
   * 它守的从来不是"必须有两行"，而是**高度只能有一个真源**。
   * 上面三条断言（css / main / controller 三者彼此相等）已经完整保留了这一点，
   * 这里再补两条同义的结构事实，让单行形态不会退化成"容器高、内容只占一半"：
   *   ① 唯一的工具栏行必须撑满 --toolbar-height
   *      （撑不满会让 ChatGPT 视图的 setBounds 与真实栏高错位 —— 页面上看不出
   *        异常，只是网页内容被压住或露出一条缝，是最难查的一类回归）；
   *   ② 历史两行令牌不得再被任何规则当高度消费（否则高度又有了第二个来源）。 */
  assert.equal(Number(cssHeight), 64, '顶栏高度应为单行 64px（现界面定案）');
  assert.match(browserCss, /\.toolbar-main\{[^}]*height:100%/,
    '单行的 .toolbar-main 必须撑满 --toolbar-height，不得再拆成两行');
  assert.doesNotMatch(browserCss, /height:\s*var\(--(?:toolbar-main-height|workspace-bar-height)\)/,
    '两行高度的令牌已无消费者 —— 不得再被任何规则当高度用（那会让高度出现第二个真源）');

  /* 第 26 轮：pageState 就绪态不占位。
   * 它是工具栏里最宽的单个元素之一（210px），却只在加载/失败时有信息量。
   * 失败态是承重功能，必须有；同时必须有 CSS 显式处理 [hidden]，
   * 否则 display:flex 会盖过 UA 的 [hidden]{display:none}，hidden 形同虚设。 */
  assert.match(browserHtml, /id="pageState" hidden/, 'pageState 初始应隐藏');
  assert.match(browserCss, /\.page-state\[hidden\]\{\s*display:none/,
    '必须显式声明 [hidden]，否则 display:flex 会让 hidden 失效');
  assert.match(read('renderer/browser.js'), /element\.hidden = !state\.loading && !state\.error/,
    'pageState 应只在加载/失败时显示');
});

test('embedded ChatGPT compacts repeated tool call records without deleting their content', () => {
  const controller = read('electron/chatViewController.js');
  assert.match(controller, /scheduleChatUiEnhancements/);
  assert.match(controller, /suspendChatUiEnhancements/);
  assert.match(controller, /mcp-tool-call-hidden/);
  assert.match(controller, /工具 ×/);
  assert.match(controller, /data-testid\^=\\?"conversation-turn-/);
  assert.match(controller, /MutationObserver/);
  assert.match(controller, /scheduleStableRefresh\(1800\)/);
  assert.match(controller, /document\.querySelector\('main'\) \|\| document\.body/);
  assert.doesNotMatch(controller, /observe\(document\.documentElement/);
  assert.doesNotMatch(controller, /scheduleAttachmentCapture/);
  assert.doesNotMatch(controller, /mcpAutoSaved/);
  assert.doesNotMatch(controller, /__mcpAttachmentObserver/);
});

test('workspace manager exposes extra authorized roots without changing the chat top bar', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  assert.match(html, /id="authorizedRootsList"/);
  assert.match(html, /id="addAuthorizedRoot"/);
  assert.match(app, /updateAuthorizedRoots/);
});

test('the release version has a single source and is never hard-coded into the manager markup', () => {
  const pkg = JSON.parse(read('package.json'));
  const html = read('renderer/index.html');
  const main = read('electron/main.js');
  const app = read('renderer/app.js');
  const stripComments = (s) => s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

  /* 第 30 轮（用户第 6 条「把 v0.2.4 这种去掉，应用的信息要单独一个模块」）。
   *
   * 改前：`<h3>网页 MCP 助手 <span>v0.2.4</span></h3>` —— 版本号是标记里的
   * 字面量，而渲染层**没有任何通路**能拿到真实版本（preload 里没有 getVersion，
   * app:snapshot 里也没有版本字段，实测过）。
   * 写死的版本号最大的问题是**它会撒谎**：package.json 改了版本，界面上还是旧数字，
   * 而且看起来完全正常 —— 没有任何一处会报错。
   *
   * ★ 所以这条护栏守的**不是"版本号等于 0.2.4"**（那只是抄了一份快照，
   *   会把正常的发版搞红，也挡不住"两处各写一个版本"），
   *   而是"版本号只有一个来源"：
   *     ① 标记里不得再出现写死的 vN.N.N；
   *     ② 主进程把 app.getVersion() 随快照带出去（app.getVersion 读的就是
   *        package.json 的 version，打包后读应用包内的版本 —— 单一真源）；
   *     ③ 渲染层把它写进应用信息模块的 #appVersionValue。
   *   ①②③ 任一条断了，版本号就会重新退化成"手抄的快照"，这条会红。
   *
   * ★ 剥注释后再断言：renderAppInfo 上方的注释里逐字引用了
   *   `v0.2.4` 这个旧写法来解释为什么要删它 —— 不剥注释就会把"解释问题的注释"
   *   当成问题本身（本项目已栽 11 次）。 */
  const htmlCode = stripComments(html);
  const appCode = stripComments(app);

  assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'package.json 的 version 应是版本号真源');
  assert.doesNotMatch(htmlCode, /v\d+\.\d+\.\d+/,
    '管理界面标记里不得再写死版本号 —— 它必须来自主进程，而不是手抄');
  /* ★ 展示位的**容器标签**从 <dd> 换成了 <span>（应用信息模块改版），
   * 但"版本号必须有一个独立的展示位"这条契约没变 —— 所以只放宽标签名。 */
  assert.match(htmlCode, /<(?:dd|span)[^>]*id="appVersionValue"/, '版本号应有独立的展示位');
  assert.match(main, /app\.getVersion\(\)/, '主进程应把真实版本随快照带出');
  assert.match(appCode, /#appVersionValue/, '渲染层应把版本写进应用信息模块');
  assert.doesNotMatch(appCode, /appVersionValue[^\n]*\d+\.\d+\.\d+/,
    '渲染层不得回落到写死的版本号 —— 回落等于把刚拆掉的雷重新埋回去');
  assert.doesNotMatch(htmlCode, /本地工具引擎/);

  /* ★ 第 30 轮负向验证抓到的三个缺口，全部补齐。
   *   之前只断言了三个"某处存在某个写法"（app.getVersion 在某处、
   *   #appVersionValue 在某处），所以下面这些改坏方式都能全绿通过：
   *     · 把 orchestrator 的 `appVersion: this.appVersion` 整行删掉
   *       → 版本号永远到不了界面，但"主进程某处确实调了 getVersion"仍为真；
   *     · 把渲染层的回落常量改成 'v0.2.4'
   *       → 正好是刚拆掉的那颗雷（一个永远为真、永远不报错的假数字）；
   *     · 把 .app-info-panel 改回 .about-panel
   *       → "独立模块"的语义错位回归，而这条产品要求没有任何断言。
   *
   *   ● 缺口 A：appVersion 必须真的**穿过**快照，不只是"存在 getVersion 调用"。
   *     断言完整的两段：main.js 把它注进 orchestrator、orchestrator 把它放进快照。
   *     用跨行正则（源码里这两处各带一行注释，不能按单行匹配）。 */
  const orch = read('electron/services/runtimeOrchestrator.js');
  assert.match(main, /appVersion:\s*app\.getVersion\(\),/,
    'main.js 必须把真实版本注入 orchestrator（只"调用过 getVersion"不算送到）');
  assert.match(orch, /appVersion:\s*this\.appVersion,/,
    'orchestrator 必须把版本放进快照对象 —— 否则它到不了渲染层');
  /* ★ 注意正则写法：构造函数签名是
   *   constructor({ settings, ..., emitStatus = () => {}, appVersion = '' }) {
   * 里面含 `() => {}`，所以不能写 `constructor\(\{[^}]*appVersion[^}]*\}` ——
   * 那个 `{}` 会提前截断匹配（第一次跑就红了，记在这里，属"断言写法"而非代码问题）。 */
  assert.match(orch, /constructor\(\{[\s\S]{0,400}?appVersion[\s\S]{0,400}?\}\)\s*\{/,
    'orchestrator 应通过构造参数接收版本，而不是自己 require electron');

  /* ● 缺口 B：渲染层的"取不到就不显示"必须逐字守住。
   *   这里断言的是**完整的兜底表达式**，不是"有 — 这个字符" ——
   *   `'v0.2.4'` 里也有数字，弱断言会被它骗过。
   *   （原意图一字未改：取不到版本时只能落到占位符「—」，绝不能落回一个
   *     写死的版本号。只是界面重写后这份值被提成一行 displayVer 常量、
   *     同时喂给展示位与徽标，所以断言从"赋值那一行"挪到"常量那一行"。） */
  assert.match(appCode,
    /const displayVer = version \? `v\$\{version\.replace\(\/\^v\/i, ''\)\}` : '—';/,
    '版本取不到时必须回落到占位符「—」；不得回落到任何写死的版本号');
  assert.match(appCode, /node\.textContent = displayVer;/,
    '版本展示位必须写这份唯一来源的值');
  assert.match(appCode, /badge\.textContent = displayVer;/,
    '徽标与展示位必须同源 —— 两处各写一个版本号又会退回"手抄快照"');

  /* ● 缺口 C：「应用信息」必须是独立模块，且**不在**偏好设置的设置栈里。
   *
   *   原判据是"全页只有一个 .settings-stack，且 .app-info-panel 落在它之外"。
   *   界面重写把管理界面拆成 13 个页面（每页各有一个 .settings-stack），
   *   应用信息整块搬进了「关于我们」页。语义没有变（"可改的偏好"与
   *   "只读的应用信息"必须分处两地），所以判据改成**按页判断**：
   *   版本展示位必须落在 about 页，且不得出现在 settings 页里。
   *   这样"把应用信息挪回偏好设置栈里"这种错位仍然会被拦下。 */
  const pageSlice = (name) => {
    const start = htmlCode.indexOf(`data-page-view="${name}"`);
    if (start < 0) return '';
    const rest = htmlCode.slice(start);
    const next = rest.slice(1).search(/<section class="page(?: active)?"/);
    return next < 0 ? rest : rest.slice(0, next + 1);
  };
  const aboutPage = pageSlice('about');
  const settingsPage = pageSlice('settings');
  assert.ok(aboutPage && settingsPage, '应能截出「关于我们」与「偏好设置」两页');
  assert.match(aboutPage, /id="appVersionValue"/,
    '应用信息（含版本展示位）必须作为只读模块独立成页/成块');
  assert.doesNotMatch(settingsPage, /id="appVersionValue"/,
    '应用信息不得混回偏好设置页 —— 那边全是"可改的偏好"，它是"只读的应用信息"');
});

test('settings and ChatGPT are two mutually exclusive surfaces inside one window', () => {
  const main = read('electron/main.js');
  const app = read('renderer/app.js');
  const css = read('renderer/styles.css');

  /* 第 22 轮之前：设置是一个独立的无边框 BrowserWindow（managerWindow），
   * 980×720 居中浮动在聊天窗口之上。
   * 第 22 轮之后：设置变成主窗口内的一个全尺寸 WebContentsView（settingsView），
   * 与 ChatGPT 视图互斥显示 —— 同一窗口、同一尺寸、含顶部工具栏。
   *
   * 为什么不能靠 CSS 隐藏：ChatGPT 是原生 WebContentsView，盖在 DOM 之上，
   * display:none 盖不住它，只有原生层的 setVisible() 才行。
   * 因此下面对"窗口 vs 视图"的断言必须同时存在，缺一即回归。 */
  assert.doesNotMatch(main, /managerWindow/, '不应再有独立的设置窗口');
  // 注意：main.js 里留有一句解释性注释「原 openManagerWindow() 在此删除」，
  // 所以这里断言的是"函数定义"而非裸名字，否则会被注释误伤。
  assert.doesNotMatch(main, /function openManagerWindow\(/, '独立窗口的构造函数应已移除');
  assert.match(main, /new WebContentsView\(/, '设置改为原生视图');
  assert.match(main, /settingsView\.setVisible\(/, '设置视图靠原生可见性切换');

  /* 互斥：切到设置要藏起 ChatGPT，切回主界面要藏起设置。
   * 漏掉任一半，两个原生视图就会叠在一起（设置下面露出 ChatGPT）。
   *
   * 第 23 轮起 ChatGPT 侧改走 setSurfaceVisible()（可见性闸门的封装），
   * 不再直接 view.setVisible()。这里断言封装后的调用，并要求
   * "直接调用"不得复活 —— 直接调用会绕过闸门，让首次加载尚未完成时
   * 就把空白视图显示出来，把占位重新埋掉（详见 chatViewController.js 的 reveal 说明）。 */
  assert.match(main, /chatController\?\.setSurfaceVisible\(false\)/, '进入设置须隐藏 ChatGPT');
  assert.doesNotMatch(main, /chatController\?\.view\?\.setVisible\(/, 'ChatGPT 侧不得绕过可见性闸门');
  assert.match(main, /settingsView\?\.setVisible\(false\)/, '返回主界面须隐藏设置');

  /* 尺寸：设置视图 y=0、占满全高（这就是"设置和主界面一样大，含顶部工具栏"）；
   * ChatGPT 视图 y=CHAT_TOOLBAR_HEIGHT，让开工具栏。 */
  assert.match(main, /function surfaceBounds\(includeToolbar\)/);
  assert.match(main, /y: includeToolbar \? 0 : CHAT_TOOLBAR_HEIGHT/);

  /* 缩放时两个视图都要跟着改尺寸，否则拉大窗口后设置视图会留下空白边。 */
  assert.match(main, /chatWindow\.on\('resize'/);

  /* ★ 这一条原来匹配的是 app.js 里一句 `Show the settings shell immediately`
   * 的英文注释 —— 界面重写时那句注释被删掉了，但注释下面的**行为契约**
   * 仍然成立：打开设置时用户看到的第一帧不能是一块空白壳。所以改断言行为：
   *   ① 设置视图必须**先按最终尺寸定位、再显示**（顺序反了会先闪一块
   *      默认尺寸的白壳，正是那句注释在解释的事）；
   *   ② 设置页在拿到第一份快照前必须停在启动壳里（booting 只在水合后摘掉）。 */
  const activate = main.match(/function setActiveSurface\(kind, focus = true\)[\s\S]*?\n\}/)?.[0] || '';
  assert.ok(activate, '应能找到 setActiveSurface（两个表面的切换口径）');
  assert.match(activate, /settingsView\.setBounds\(surfaceBounds\(true\)\);\s*settingsView\.setVisible\(true\);/,
    '打开设置必须先定好尺寸再显示 —— 顺序反了会先闪一块默认尺寸的白壳');
  const firstHydration = app.indexOf('await refreshSnapshot(');
  const firstUnboot = app.indexOf("document.body.classList.remove('booting')");
  assert.ok(firstHydration > 0 && firstUnboot > firstHydration,
    '必须先拿到第一份快照再摘掉启动壳 —— 否则用户会先看到一帧空白界面');
  // 原先这些声明在 settings-compact.css（一层 132 个 !important 的竞争覆盖）。
  // 该文件已拆解并入 styles.css，断言随之指向合并后的位置。
  assert.match(css, /grid-template-columns:\s*220px/);
  /* ★ 原判据写死了 74px。现紧凑规范把设置页的行高收到 54px（并且是
   *   `[data-page-view="settings"]` 作用域下的一条显式规则，而不是靠
   *   132 个 !important 互相覆盖）—— 所以要守的是"设置页的行有明确的
   *   尺寸契约、且它挂在设置页作用域上"，不是那个数字。 */
  assert.match(css, /\.page\[data-page-view="settings"\] \.setting-row\s*\{[^}]*min-height:\s*\d+px/,
    '设置页的行必须有明确的 min-height 契约（作用域挂在设置页上）');
  assert.match(css, /\.page\[data-page-view="settings"\] \.setting-row\s*\{[^}]*padding:/,
    '设置页的行必须有明确的 padding 契约（否则行会贴着容器边）');
});

test('the ChatGPT view stays hidden until its first content is ready', () => {
  const controller = read('electron/chatViewController.js');
  const main = read('electron/main.js');

  /* 第 23 轮实测出来的问题：
   *   ChatGPT 是原生 WebContentsView，**永远合成在宿主页 renderer 之上**。
   *   browser.html 里的 .loading-stage（转圈 + "正在打开 ChatGPT"）与这个
   *   视图**逐像素重合**（两边实测都是 x0 y112 1346×752），于是占位在任何
   *   时刻都被完全遮住 —— 它从写下的那天起就没被人看到过。
   *   而实测的空白窗口期是：窗口可见 +0.86s → ChatGPT 出内容 +3.58s，
   *   中间 2.72 秒用户只能盯着一块纯色空白。
   *
   * 修法：首次内容就绪前不显示原生视图，让下面的占位真的露出来。
   * 下面几条断言就是把这个机制钉死。 */
  assert.match(controller, /this\.revealed = false;/, '初始必须是未放行状态');
  assert.match(controller, /applyVisibility\(\)\s*\{/, '可见性收敛到单一出口');
  assert.match(controller, /this\.view\.setVisible\(this\.surfaceVisible && this\.revealed\)/,
    '可见性 = 表面在显示 且 内容已就绪（两者与关系，缺一都会出 bug）');
  assert.match(controller, /setSurfaceVisible\(wanted\)/, '主进程通过封装改可见性');
  assert.match(controller, /checkContentAndReveal\(\)/, '放行判据统一收在一处');
  assert.match(controller, /this\.reveal\(\);/, '内容就绪时放行');

  /* 不能"事件一来就放行"：实测 did-stop-loading 在一个生命周期里会触发两次
   * （初始空文档 + 真正加载完），第一次来时页面还是空的。
   * 因此判据必须是**直接问页面有没有内容**，并且要认 URL 是不是真导航过。
   * 这两条是第 23 轮运行时实测抓出来的，不是推理出来的。 */
  assert.match(controller, /contentReady\(\)\s*\{/, '要有"是否真导航到目标站点"的判断');
  assert.match(controller, /isAllowedNavigation\(contents\.getURL\(\)\)/, '复用既有白名单判断导航');
  assert.match(controller, /childElementCount/, '要看 DOM 里是否真有子元素');
  /* 加载期间绝不能调 executeJavaScript：Electron 会为排队的调用临时挂
   * did-stop-loading 监听器，150ms 一次轮询会把监听器撑到 11 个，
   * 触发 MaxListenersExceededWarning（实测过，是这次引入的）。
   * 加 isLoading() 闸门后消失。 */
  assert.match(controller, /if \(contents\.isLoading\(\)\) return;/, '加载期间不得探询页面');
  assert.match(controller, /startRevealWatch\(\)/, '还要有轮询兜底');
  assert.match(controller, /setInterval\([\s\S]{0,120}?checkContentAndReveal\(\)/, '轮询复用同一判据');

  /* 兜底：did-stop-loading 万一不来（崩溃/卡死），不能让视图永远不显示 ——
   * 那会变成一片永久空白，比原问题更糟。 */
  assert.match(controller, /revealTimer = setTimeout\(/, '必须有超时兜底');
  assert.match(controller, /强制显示视图以避免永久空白/);

  /* 失败路径不能让占位一直转圈撒谎：
   * 不可重试的失败要立刻放行；渲染进程没了也要放行。
   * 每条放行路径都带原因标记（content-ready / timeout / load-failed /
   * render-gone）—— 运行时验证正是靠它把"正常放行"和"兜底放行"区分开的。 */
  assert.match(controller, /const willRetry = this\.scheduleTransientRetry/);
  assert.match(controller, /if \(!willRetry\) this\.reveal\('load-failed'\);/);
  assert.match(controller, /this\.reveal\('timeout'\)/, '超时兜底要标原因');
  assert.match(controller, /this\.reveal\('render-gone'\)/, '渲染进程退出也要放行');

  /* 切回主界面必须走闸门封装，不能直接 setVisible(true)，否则首次加载
   * 未完成时会把空白视图强行显示，闸门白设。 */
  assert.match(main, /chatController\.setSurfaceVisible\(true\)/);
});

test('settings page offers a way back to the main interface', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  const css = read('renderer/styles.css');
  const preload = read('electron/preload.js');
  const browserPreload = read('electron/browserPreload.js');

  /* 合并之前，设置窗口左上角是一个 `×`（"关闭设置"）；关掉后主窗口自动
   * 重新聚焦，所以不需要"返回"按钮。
   * 合并之后没有第二个窗口可关，必须有一个明确的回到 ChatGPT 的入口，
   * 否则用户进了设置就出不来。 */
  assert.match(html, /id="backToMain"/);
  assert.match(html, /返回主界面/);
  assert.doesNotMatch(html, /title="关闭设置"/, '不再是关窗口，文案应改为返回');
  assert.match(app, /#backToMain/);
  assert.match(app, /api\.closeSettings\(\)/);

  /* 键盘 Esc 与左上角按钮是同一个动作的两个入口。 */
  assert.match(app, /event\.key === 'Escape'/);

  /* 顶部这条栏的职责从"假窗口标题栏"变成"应用内导航栏"。
   *
   * ★ 第 41 轮**推翻了**原判据（原文：不得再留 -webkit-app-region:drag，
   *   "现在拖动它不会移动任何东西，留着只会误导"）。
   *   那条推导默认这个窗口有原生标题栏。实测该前提不成立：
   *   electron/main.js 里窗口用的是 titleBarStyle:'hidden' + titleBarOverlay
   *   （无边框），设置视图与 ChatGPT 视图又是**同一个窗口**里的两块表面 ——
   *   于是这条 42px 的栏成了唯一能拖动窗口的区域，去掉它，用户只能靠
   *   系统快捷键挪窗口。所以判据**反向**，并把"按钮还点得动"一起钉住：
   *   栏是拖拽区，栏内的交互控件必须显式 no-drag，否则点击会被拖拽吃掉。 */
  assert.match(css, /\.manager-window-bar\{[^}]*-webkit-app-region:drag/,
    '设置页顶部这条栏必须仍是窗口拖拽区 —— 窗口是无边框的（titleBarStyle:hidden），'
    + '去掉 drag 后它就是唯一可拖动窗口的区域，没了它窗口挪不动');
  assert.match(css, /\.manager-back\{[^}]*-webkit-app-region:no-drag/,
    '拖拽区里的返回按钮必须显式 no-drag —— 否则点它会变成拖窗口，按钮形同虚设');
  assert.match(css, /\.manager-back\{/);

  /* 命名必须跟着语义走：动作已从"关窗口"变成"返回界面"。 */
  assert.match(preload, /closeSettings: \(\) => ipcRenderer\.invoke\('manager:close'\)/);
  assert.doesNotMatch(preload, /closeManager:/, 'closeManager 会让人以为在关窗口');
  assert.match(browserPreload, /openSettings: \(page\) => ipcRenderer\.invoke\('manager:open', page\)/,
    'ChatGPT 顶栏的「设置」入口必须仍走 manager:open（第 41 轮起带上目标页参数，'
    + '以便「前往配置」直接落到运行与连接页）');
  assert.doesNotMatch(browserPreload, /openManager:/);
});

test('CSS layers collapsed to a single token source plus one design-system file', () => {
  const html = read('renderer/index.html');
  const tokens = read('renderer/design-tokens.css');
  const css = read('renderer/styles.css');
  // 竞争覆盖层已移除：设置窗口只加载两张样式表
  assert.doesNotMatch(html, /settings-compact\.css/);
  assert.match(html, /href="design-tokens\.css"/);
  assert.match(html, /href="styles\.css"/);
  /* ★ 令牌只能定义在 design-tokens.css，styles.css 不得再定义设计系统令牌。
   * 历史：styles.css 曾重复定义 19 个令牌，因加载在后而一直胜出，
   * 使 design-tokens.css 的同名值沦为死代码。
   *
   * 现界面的 styles.css 里有 2 个**组件级局部变量**（.log-panel 的列宽），
   * 它们不构成"第二个真源"，所以原判据 `^\s*--x:` 收紧成两条：
   *   ① 不得与 design-tokens.css 里的任何令牌**重名**（重名才是真危险）；
   *   ② 不得在全局层（:root / html / body）定义任何令牌。 */
  const designTokenNames = [...tokens.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]);
  assert.ok(designTokenNames.length > 10, 'design-tokens.css 应是令牌的主来源');
  const redefined = designTokenNames.filter((t) => new RegExp(`^\\s*${t}\\s*:`, 'm').test(css));
  assert.deepEqual(redefined, [],
    `styles.css 重定义了 design-tokens.css 已有的令牌（会让同名值沦为死代码）：${redefined.join(', ')}`);
  for (const block of css.matchAll(/(?:^|\})\s*(:root|html|body)(\[[^\]]*\])?\s*\{([^}]*)\}/g)) {
    assert.doesNotMatch(block[3], /--[a-z0-9-]+\s*:/,
      `${block[1]} 是全局层：不得在这里定义令牌（令牌的唯一真源是 design-tokens.css），实得：${block[3].trim()}`);
  }
  // 浅色令牌块必须同时匹配 <html>，否则 <html> 会落到深色令牌上
  assert.match(tokens, /:root\[data-theme="light"\],\s*body\[data-theme="light"\]/);
  // 主操作按钮走令牌，不再硬编码
  assert.match(css, /\.primary-button\{ color: var\(--btn-primary-fg\); background: var\(--btn-primary-bg\)/);
});

test('theme switching writes data-theme to both <html> and <body>, so :root tokens follow', () => {
  /* 第 28 轮：这条守的是一个真实存在过的 BUG。
   *
   * 症状：偏好设置里把「界面主题」改成浅色，界面几乎没反应。
   *
   * 根因：applyTheme() 只写 document.body.dataset.theme，**从不写 <html>**；
   * 而 design-tokens.css 把深色令牌块挂在 :root{} 上，浅色块的选择器是
   * `:root[data-theme="light"], body[data-theme="light"]`。于是 <html> 的
   * data-theme 永远停在 theme-bootstrap.js 于**应用启动那一刻**写入的值，
   * :root 令牌（--bg/--surface/--text/--green/--red…）永不跟随切换。
   *
   * 实测证据（Electron 真机，theme=dark 启动后选浅色）：
   *     html.data-theme : dark → dark（不变）   body.data-theme : light → light
   *     :root 的 --bg   : #141414 → #141414（期望浅色 #eef1f6）
   *
   * 为什么这条必须存在：这种"少写一行"的缺陷**不会报任何错**，
   * 静态看代码也像是对的（applyTheme 确实设置了 theme）。它只在运行时
   * 表现为"部分颜色变了、大部分没变"，非常像"感觉没做好"而不是"坏了"。
   * 所以要用断言把"必须同时写两处"固化下来。 */
  const app = read('renderer/app.js');
  const bootstrap = read('renderer/theme-bootstrap.js');
  const tokens = read('renderer/design-tokens.css');

  // 1) 切换路径：两个元素都要写
  const applyThemeBody = app.match(/function applyTheme\([\s\S]*?\n}/);
  assert.ok(applyThemeBody, '应能找到 applyTheme 函数体');
  assert.match(applyThemeBody[0], /document\.documentElement\.dataset\.theme\s*=/,
    'applyTheme 必须写 <html> 的 data-theme（否则 :root 令牌不跟随切换）');
  assert.match(applyThemeBody[0], /document\.body\.dataset\.theme\s*=/,
    'applyTheme 必须写 <body> 的 data-theme（否则 body[data-theme] 规则不生效）');

  // 2) 启动路径：theme-bootstrap 也要写两处，且与切换路径保持一致
  assert.match(bootstrap, /document\.body\.dataset\.theme\s*=/,
    'theme-bootstrap 必须写 <body>');
  assert.match(bootstrap, /document\.documentElement\.dataset\.theme\s*=/,
    'theme-bootstrap 必须写 <html>');

  // 3) 前提校验：深色令牌确实挂在 :root 上。
  // 若哪天有人把深色块也改成 body-scoped，这条测试的动机就消失了，
  // 应该连同上面两条一起重新评估，而不是继续留着一条无意义的断言。
  assert.match(tokens, /:root\s*\{/,
    '深色令牌应挂在 :root —— 这正是"必须写 <html>"的原因；若改了结构请重审本测试');

  // 4) 计数护栏：每个文件里"写 <body>"与"写 <html>"的次数必须相等。
  //
  // 用计数而不是"检查某条正则后面是否紧跟另一条"：后者依赖书写顺序，
  // 把两次赋值调换位置就会误报（本测试第一版就因此失败）。
  // 计数法只关心"写入点成对出现"，与顺序无关，也不会被读取语句干扰
  // —— 所以先把注释剥掉，再用"赋值号右侧是主题变量"来锁定写入点，
  // 避开 `const next = document.body.dataset.theme === 'light'` 这类读取。
  for (const [name, source] of [['renderer/app.js', app], ['renderer/theme-bootstrap.js', bootstrap]]) {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const bodyWrites = code.match(/document\.body\.dataset\.theme\s*=\s*[^=]/g) || [];
    const htmlWrites = code.match(/document\.documentElement\.dataset\.theme\s*=\s*[^=]/g) || [];
    assert.equal(bodyWrites.length, htmlWrites.length,
      `${name}: 写 <body> 的 ${bodyWrites.length} 处与写 <html> 的 ${htmlWrites.length} 处必须成对，` +
      '否则会出现"启动态与切换态主题不一致"或"部分颜色不跟随切换"');
    assert.ok(bodyWrites.length >= 1, `${name}: 应至少有一处主题写入点`);
  }
});

test('the three overview flow icons occupy the same visual box, so none reads as smaller', () => {
  /* 第 28 轮：这条守的是"图标留白"这类**无报错、纯视觉**的缺陷。
   *
   * 症状：用户指出「运行总览里'本地工具'图标比旁边两个小一些」。
   * 实测确认不是错觉 —— 三个 .node span svg 的 CSS 尺寸**完全相同**（都是 23×23），
   * 但立方体路径 x 只占 5..19（14 单位），而文件夹与地球占 3..21（18 单位），
   * 于是立方体的**可见宽度只有 13.4px，比旁边的 17.2px 小 22%**。
   *
   * 为什么值得用测试守：CSS 尺寸相同、代码看起来完全正确、没有任何报错，
   * 但它**肉眼可辨**，会被直接描述成"感觉没做好"。静态检查发现不了它。
   *
   * 为什么**只守这一组**（而不是全站所有内联图标）：
   * 这条测试的第一版对全站图标套用"横向 ≥60%"的阈值，结果一次报出 10 个
   * —— 但其中绝大多数是**正当**的：导航图标里有水平线条（`M8.5 6h12`，
   * 天然只占横向一部分）、列表箭头（`m9 5 7 7-7 7`，就是个窄箭头）。
   * 对它们要求"画满画布"是错的。
   * 真正的契约只存在于**这一组必须并排比较的三个图标**之间：
   * 它们被放在同样大小的方框里横向并列，所以只要有一图形留白更多，
   * 就会立刻显出大小差异。这才是有意义的断言范围。
   *
   * 判据改用**具体路径坐标**而不是通用解析：
   * 与其写一个不可靠的 SVG 解析器（H/V 指令是单值、A 指令前 5 个参数不是坐标，
   * 按"两两成对"取会错位 —— 第一版就栽在这里），
   * 不如直接锁住这三个图标的已知形状：都要触达 x≈3 与 x≈21。 */
  /* ★ 界面重写把首页的三节点流程图（.connection-visual）换成了「当前状态」
   * 三行列表，隐藏兼容桩里已经没有图标可量。原意图一字未改：
   * **三个并排的视觉单元必须一样大，不能有一个看起来偏小**。
   * 在新结构上，等价的成立条件是三件事：
   *   ① 恰好三行可见状态项，且三行的内部结构逐项相同
   *      （标签列 / 值列 / 徽标列 + 圆点 + 箭头）；
   *   ② 三行共用一条尺寸规则，没有任何"按行号单独覆盖尺寸"的规则；
   *   ③ 三行里的箭头图标逐字相同 —— 路径没画满画布才会"看起来小一些"，
   *      而三处的 CSS 尺寸完全相同、从代码上看不出原因（与旧立方体同一条教训）。 */
  const html = read('renderer/index.html');
  const css = read('renderer/styles.css');

  const listStart = html.indexOf('class="overview-status-list"');
  assert.ok(listStart > 0, '应能找到运行总览的「当前状态」列表');
  const list = html.slice(listStart, html.indexOf('</section>', listStart));
  const rows = list.split(/(?=<div class="overview-status-item)/)
    .filter((chunk) => chunk.startsWith('<div class="overview-status-item'));
  assert.equal(rows.length, 3, `「当前状态」应恰好三行可见状态项，实际 ${rows.length} 行`);

  const labels = ['本地服务', 'ChatGPT', '工作文件夹'];
  const shapeOf = (row) => ['status-col-label', 'status-col-value', 'status-col-badge', 'status-dot-sm', 'status-arrow-icon']
    .map((cls) => (row.match(new RegExp(`class="${cls}`, 'g')) || []).length).join('/');
  assert.deepEqual(rows.map(shapeOf), ['1/1/1/1/1', '1/1/1/1/1', '1/1/1/1/1'],
    `三行状态项的内部结构必须逐项相同 —— 缺一列的那一行会读起来"更小/更弱"：`
    + rows.map(shapeOf).join(' | '));
  labels.forEach((label, i) => {
    assert.ok(rows[i].includes(`>${label}</span>`), `第 ${i + 1} 行应是「${label}」`);
  });

  /* ③ 箭头图标逐字相同（路径快照式判据，不需要解析几何）。 */
  const arrows = rows.map((row) => row.match(/<svg class="status-arrow-icon"[\s\S]*?<\/svg>/)?.[0] || '');
  assert.ok(arrows.every(Boolean), '三行状态项都要有箭头图标');
  assert.equal(new Set(arrows).size, 1,
    '三行的箭头图标必须逐字相同 —— 有一个路径没画满画布就会"看起来小一些"，而 CSS 尺寸完全相同');
  assert.match(arrows[0], /viewBox="0 0 16 16"/, '箭头画布应统一为 16×16');
  assert.match(arrows[0], /d="M6 12l4-4-4-4"/,
    '箭头应画满画布（x 6..10 居中占满）而不是缩在一角');

  /* ② CSS：三行共用一条尺寸规则，且没有按行号单独覆盖尺寸。 */
  const itemRules = [...css.matchAll(/^\.overview-status-item\s*\{([^}]*)\}/gm)].map((m) => m[1]);
  assert.equal(itemRules.length, 1, '.overview-status-item 的完整外观应只有一处定义');
  assert.match(itemRules[0], /grid-template-columns:\s*\d+px minmax\(0,\s*1fr\) auto/,
    '三行必须共用同一条列模板（标签列定宽 + 值列伸缩 + 徽标列自适应）');
  assert.doesNotMatch(css, /\.overview-status-item:nth-child\([^)]*\)\s*\{[^}]*(?:min-height|padding|font-size|grid-template-columns)/,
    '不得为某一行单独覆盖尺寸 —— 那正是"其中一行看起来偏小"的机制');
  assert.doesNotMatch(css, /\.overview-status-item[^{]*\.status-dot-sm[^{]*\{[^}]*(?:width|height):\s*\d/,
    '不得为某一行单独覆盖状态圆点尺寸');
});

test('state-changing save buttons live in the page header, not at the page bottom', () => {
  /* 第 28 轮：这条守"重要按钮的位置契约"。
   *
   * 用户原话：「'保存工作区设置'和'保存并重新部署'两个按钮的位置要放到右上角，
   * 这种重要的按钮不能放到最后面」「'保存配置并部署完整服务'的两个按钮也要放到上面」。
   *
   * 为什么这是个值得固化的契约，而不只是一次性调整：
   * 这些按钮**会改变系统状态**（保存并重新部署会重启 MCP、重写访问边界；
   * 保存并开始部署会拉起连接通道）。它们属于"这一刻要做的决定"，
   * 而不是"读完这一页的收尾动作"。
   * 放在页尾意味着用户必须先滚过整页表单才看得到 —— 看完还得滚回来点。
   * 这个判断不依赖具体像素，所以可以用结构断言守住：
   * 按钮必须在 .section-header 里（页头右槽位），且不得出现在页尾容器里。
   */
  const html = read('renderer/index.html');
  const css = read('renderer/styles.css');
  const app = read('renderer/app.js');

  /* 1) 状态变更类保存按钮必须落在**页头**，不得落在页尾。
   *    ★ 第 41 轮重锚：原判据锚在「工作区与权限」页的 .section-header 里
   *      （#saveWorkspace / #saveWorkspaceRestart）。那个页面已删除，
   *      两个保存动作随之上移到**顶栏动作槽**（窗口右上角 = 页头右槽位）：
   *        · 保存设置        → #saveDeploySettings
   *        · 保存并重新部署  → #saveWorkspaceRestart（第 41 轮从"空隐藏节点"
   *          搬回可见位置 —— 它是普通功能，不是开发者调试）
   *      原意图一字未改：会改变系统状态的保存按钮必须在页头，不能埋在页尾。
   *      新判据三条：① 两个动作都在 .top-actions 里；② 显隐真的由判据表驱动
   *      （只在 HTML 里写 hidden 而没人驱动 = 永远不出现）；③ 页尾容器已不存在。 */
  const topActions = html.match(/<div class="top-actions">([\s\S]*?)<\/header>/)?.[1] || '';
  assert.ok(topActions, '应能找到顶栏动作槽 .top-actions');
  assert.match(topActions, /id="saveDeploySettings"/,
    '「保存设置」必须在页头右槽位（.top-actions）内，不能埋到页尾');
  assert.match(topActions, /id="saveWorkspaceRestart"/,
    '「保存并重新部署」必须在页头右槽位内 —— 第 28 轮用户原话要求放右上角，'
    + '藏进不可见的节点等于把这条能力砍掉');
  assert.match(app, /if \(saveRestart\) saveRestart\.hidden = !rule\.save;/,
    '顶栏「保存并重新部署」必须由 applyTopActions 按判据表驱动显隐 —— '
    + '否则它只是一个写着 hidden 的空壳，永远不会出现');
  assert.doesNotMatch(html, /id="saveWorkspace"/,
    '纯保存的 #saveWorkspace 已与「保存设置」合并，不应再留一个不可见的同名能力');

  /* 2) 运行与连接页：**动作卡必须排在配置卡之前**。
   *    ★ 第 41 轮重锚：原判据锚在 .deploy-footer（"页头之后、deploy-grid 之前"），
   *      界面重写把这一页改成三张 .deploy-card-group 卡片，footer 与 deploy-grid
   *      都不存在了。原意图没变：**"这一刻要做的决定"必须排在"慢慢改的配置"前面**，
   *      不能让用户先滚过整页表单才看到动作入口。
   *      新判据用卡片的稳定 id：ChatGPT 连接卡（含可见动作 #deployConnectBtn）
   *      必须排在网络卡与工作区授权卡之前。 */
  const deployPage = html.match(/data-page-view="deploy"[\s\S]*?data-page-view="guide"/);
  assert.ok(deployPage, '应能找到运行与连接页');
  const connectIdx = deployPage[0].indexOf('id="deployConnectBtn"');
  const proxyIdx = deployPage[0].indexOf('id="proxyCardSection"');
  const workspaceIdx = deployPage[0].indexOf('id="workspaceAuthSection"');
  assert.ok(connectIdx >= 0 && proxyIdx > 0 && workspaceIdx > 0,
    '运行与连接页应同时存在连接动作卡 / 网络配置卡 / 工作区授权卡');
  assert.ok(connectIdx < proxyIdx && connectIdx < workspaceIdx,
    '连接动作必须排在两张配置卡之前 —— 否则用户要先滚过整页表单才看得到它');

  /* 3) 页尾容器必须已彻底移除（避免留下一个空壳或双份按钮） */
  assert.doesNotMatch(html, /class="page-footer-actions"/,
    '.page-footer-actions 已废弃（其唯一用例已上移），不应再出现');
  /* 断言前必须剥掉注释：本轮在 styles.css 里留了一条说明，其中**引用了**
   * 被删掉的那条规则原文（`.page-footer-actions{justify-content:flex-end;...}`）
   * 作为"删了什么"的记录 —— 不剥注释就会被自己的文档搞红。
   * 这与之前 browser.css 那条令牌护栏被注释里的 var(--radius-*) 触发是同一类问题：
   * 正则看不见注释与代码的区别。 */
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(cssCode, /\.page-footer-actions\s*\{/,
    '应同时删掉 .page-footer-actions 的样式规则');

  /* 4) 「现在处于什么前置状态」这句话必须还在、且用户真的读得到。
   *    ★ 第 41 轮重锚：原判据断言 #deploySummary 存在 —— 它现在是一个**永久隐藏的
   *      空节点**（app.js 的 renderDeploySummary 把它清空并 hidden=true）。
   *      "节点在、内容永远是空的"正是本项目反复点名的假绿形态，不能当护栏用。
   *      摘要的职能已分流到各张动作卡标题下的**可见副标题**（用户真正读到的是它们），
   *      所以判据改锚到那两处，并保留"必须由 JS 写入"这半边：
   *      只写静态初值的摘要会一直停在旧文案，与按钮当时的状态对不上。 */
  assert.match(html, /id="deployChatGptSubtitle"/,
    'ChatGPT 连接卡的可见摘要必须保留 —— 它替用户回答"现在连上没有"');
  assert.match(app, /\$\('#deployChatGptSubtitle'\)/,
    '连接摘要必须由 JS 写入当前状态（静态初值会一直停在旧文案）');
  assert.match(html, /id="deployNetworkSummaryText"/,
    '网络卡的可见摘要必须保留 —— 它替用户回答"代理走的是哪条路"');
});

test('only one text "刷新" button remains; panel-level reloads are small icon buttons', () => {
  /* 第 28 轮：用户原话「每一个界面都有'刷新'和'启动服务'，太冗余了」。
   *
   * 实测确认属实，而且比描述的更多：顶栏的「刷新」「启动服务」在**每个页面**
   * 都显示，同时各页又各自有一个刷新类按钮。其中语义重复的「刷新」共 **4 个**：
   *   ① 顶栏 #refreshButton（全局，重读快照）—— 保留
   *   ② 工作区页 #refreshWorkspaceContext（重读工作区上下文）
   *   ③ 接入指南页 #refreshCodingToolsGuide（重读 MCP 指令）
   *   ④ 日志页 #refreshLogs（重载日志，且是 primary-button 样式，权重最高）
   *
   * 处理：**降级而非删除**。②③④ 各自加载的是不同数据，
   * 全局刷新只重读快照、覆盖不了它们 —— 删掉会让用户失去唯一的重载入口。
   * 所以改成 24×24 的 .panel-icon-button，放进对应面板的标题栏或工具栏。
   *
   * 这条测试守的就是这个结论：能力保留、视觉冗余消除、且全局入口只剩一个。 */
  const html = read('renderer/index.html');
  const css = read('renderer/styles.css');
  const app = read('renderer/app.js');

  /* 1) 带文字的「刷新」按钮只允许剩一个（顶栏全局那个）。
   *    第 18 轮时任务页的 #refreshTaskState 还是 primary-button 的文字「刷新」，
   *    当时为了让这条测试不变成"永远差一个"的假红，先把它排除在外，
   *    并注明"由其自身的收纳需求处理"。
   *    第 28 轮（用户第 9 条）已把那个收纳需求做掉了：它现在是
   *    .panel-icon-button 的图标「↻」，与其它三个面板级刷新同一档。
   *    所以这里的白名单**收窄到只剩顶栏全局刷新** —— 若哪天又冒出一个
   *    带文字的「刷新」，这条测试会直接红，而不是被白名单悄悄放过。 */
  const textRefresh = (html.match(/<button[^>]*>\s*刷新\s*<\/button>/g) || [])
    .map((b) => (b.match(/id="([^"]+)"/) || [])[1] || '(无id)');
  const unexpected = textRefresh.filter((id) => id !== 'refreshButton');
  assert.equal(unexpected.length, 0,
    `除顶栏全局刷新外，不应再有带文字的「刷新」按钮；发现 ${unexpected.join(', ')}`);

  /* 2) 四个面板级刷新必须是 .panel-icon-button，且不再用 secondary/primary 样式。
   *    第 28 轮把 #refreshTaskState 也收进这一档（原来它是 primary-button 的文字「刷新」）。 */
  for (const id of ['refreshWorkspaceContext', 'refreshCodingToolsGuide', 'refreshLogs', 'refreshTaskState']) {
    assert.match(html, new RegExp(`class="panel-icon-button[^"]*" id="${id}"`),
      `${id} 应为小图标按钮（.panel-icon-button）`);
    assert.doesNotMatch(html, new RegExp(`class="(?:secondary|primary)-button[^"]*" id="${id}"`),
      `${id} 不应再用次级/主按钮样式 —— 那只是把文字换成图标、体积没变`);
  }

  /* 3) 三个刷新各自放在语义最贴合的区块里：
   *    前两个在面板标题栏，日志那个在日志工具栏（它重载的就是这块列表）。 */
  assert.match(html, /class="panel-title"[\s\S]{0,200}?id="refreshWorkspaceContext"/,
    '工作区上下文刷新应放在该面板的 .panel-title 内');
  assert.match(html, /class="guide-instruction-bar"[\s\S]{0,900}?id="refreshCodingToolsGuide"/,
    'MCP 指令刷新应放在该面板的标题栏内（原判据是 .panel-title，界面重写后这一栏叫 .guide-instruction-bar）');
  /* ★ 第 41 轮重锚：这条原本靠"起始标记后 400 字以内"定位，而日志工具栏
   *   现在分成左右两槽（左：搜索 + 级别筛选；右：自动滚动 + 刷新），
   *   刷新落在右槽里 —— 距 .log-toolbar 起点 1600 多字符。
   *   字窗口只是定位手段，原意图是**"日志刷新必须长在日志工具栏里"**这个
   *   从属关系，所以改成真的做容器配对：把 .log-toolbar 的内部 HTML 切出来，
   *   再断言刷新在里面。窗口再大也只是猜，配对才是事实。 */
  const logToolbarOpen = html.indexOf('class="log-toolbar"');
  assert.ok(logToolbarOpen > 0, '应能找到日志面板的 .log-toolbar');
  const logToolbarStart = html.lastIndexOf('<div', logToolbarOpen);
  let logDepth = 0;
  let logToolbarInner = '';
  const divTagRe = /<div\b[^>]*>|<\/div>/g;
  divTagRe.lastIndex = logToolbarStart;
  for (let m = divTagRe.exec(html); m; m = divTagRe.exec(html)) {
    logDepth += m[0].startsWith('</') ? -1 : 1;
    if (logDepth === 0) { logToolbarInner = html.slice(logToolbarStart, m.index); break; }
  }
  assert.ok(logToolbarInner, '应能配对出 .log-toolbar 的内部 HTML');
  assert.match(logToolbarInner, /id="refreshLogs"/,
    '日志刷新必须长在日志工具栏（.log-toolbar）里 —— 它重载的就是这块列表');

  /* 4) 能力不能消失：三个按钮的绑定必须仍在 */
  assert.match(app, /\$\('#refreshWorkspaceContext'\)\?*\.addEventListener\('click', loadWorkspaceContext\)/,
    '工作区上下文刷新必须仍绑定 loadWorkspaceContext');
  assert.match(app, /\$\('#refreshCodingToolsGuide'\)\?*\.addEventListener\('click', loadCodingToolsGuide\)/,
    'MCP 指令刷新必须仍绑定 loadCodingToolsGuide');
  assert.match(app, /\$\('#refreshLogs'\)\?*\.addEventListener\('click', loadLogs\)/,
    '日志刷新必须仍绑定 loadLogs');
  /* 第 28 轮新增：任务页刷新降级为图标后，绑定必须还在 ——
   * 元素样式变了但事件丢了，是这个项目最容易犯的"改了外观忘了接线"错误。
   * ★ 第 45 轮重锚：把 `\?*` 补上，与上面两条（工作区 / MCP 指令）一致。
   *   判据守的是"点击真的接到了处理器上"，而 `$('#x')?.addEventListener(...)`
   *   与 `$('#x').addEventListener(...)` 在这一点上完全等价 ——
   *   可选链只是多了一层"元素不在就跳过"的保护，不会让绑定消失。
   *   原写法把"必须不带 ?"也一并钉死，属于比意图更严的措辞，会误红。 */
  assert.match(app, /\$\('#refreshTaskState'\)\?*\.addEventListener\('click', loadTaskState\)/,
    '任务页刷新必须仍绑定 loadTaskState（样式降级不应动绑定）');

  /* 5) 全局「刷新」必须保留（它是覆盖面最广的那个）。
   *
   * ★ 第 30 轮（用户第 4 条「还有刷新按钮太简陋了」）改了它的形态：
   *   从**纯文字**按钮 → **图标 + 文字**按钮（.refresh-button，含 .refresh-icon），
   *   并在点击期间旋转、禁用。所以这条断言必须跟着抬头，
   *   不能再钉"必须是纯文字"—— 那正是用户嫌简陋的地方。
   *
   *   但**收紧的部分不能丢**：改形态不能变成改能力。这里同时钉住
   *     ① 仍是 .secondary-button（它是这条工具栏里的次级动作，主次关系不变）；
   *     ② 仍有可见文字「刷新」（不能退化成只剩一个图标 —— 那会让
   *        "刷新什么"变得要猜，比原来更差）；
   *     ③ 文字与图标都在同一个按钮里，不是两个并列按钮。 */
  /* 顶栏全局「刷新」应保留，并带 .refresh-button 标记。
   * 类名列表允许追加尺寸档（btn-sm）—— 判据要的是"这个按钮属于刷新族"，
   * 不是"它的 class 属性一字不差"。 */
  assert.match(html, /class="secondary-button refresh-button[^"]*" id="refreshButton"/,
    '顶栏全局「刷新」应保留，并带 .refresh-button 标记');
  /* ★ 第 45 轮重锚：原判据用「id 之后 400 字内出现 class="refresh-icon"、
   *   再 200 字内出现 <span>刷新</span>」的**字窗口**定位。
   *   界面重写把这枚图标换成 4 段路径的同步图标（.modern-refresh-svg），
   *   并给 class 追加了变体名，于是 ① `class="refresh-icon"` 逐字匹配落空、
   *   ② 到文字的距离超过 200 字 —— 两处都只是"定位手段"失效，不是能力丢失。
   *   原意图是**"图标与文字在同一个按钮里"**（③ 收紧的那半边），
   *   所以改成真的做容器配对：把 <button id="refreshButton"> 的内部 HTML
   *   切出来，再断言里面既有 refresh-icon 图标、也有「刷新」文字。
   *   窗口再大也只是猜，配对才是事实。 */
  const refreshBtnAt = html.indexOf('id="refreshButton"');
  const refreshBtnOpen = html.lastIndexOf('<button', refreshBtnAt);
  const refreshBtnClose = html.indexOf('</button>', refreshBtnAt);
  const refreshBtnHtml = html.slice(refreshBtnOpen, refreshBtnClose + '</button>'.length);
  assert.match(refreshBtnHtml, /class="[^"]*\brefresh-icon\b[^"]*"/,
    '刷新按钮里应有 .refresh-icon 图标（类名可带变体，但图标必须在这枚按钮内）');
  assert.match(refreshBtnHtml, /<span>刷新<\/span>/,
    '刷新按钮应是「图标 + 文字」—— 文字必须在，否则"刷新什么"要靠猜');

  /* 6) 样式必须存在，且尺寸要真的比 .icon-button 小（否则换了等于没换）。
   * ★ 第 45 轮重锚：界面重写把这一档定为 **32×32**（原判据写死 24×24），
   *   并把"带文字的胶囊"拆成 .modern-refresh-btn 变体（width:auto）。
   *   要守的性质没变 —— .panel-icon-button 必须小于 .icon-button 的 36×36。 */
  assert.match(css, /\.panel-icon-button\s*\{[^}]*width:\s*32px[^}]*height:\s*32px/,
    '.panel-icon-button 应是 32×32 —— 必须小于 .icon-button 的 36×36');
  assert.match(css, /\.icon-button\{ width: 36px/,
    '.icon-button 仍是 36px；.panel-icon-button 是它之外的更小一档');

  /* 7) 第 30 轮：刷新必须**有反馈** ——「简陋」的实处是点下去没有回话，
   *    不是长得丑。所以这里钉的是行为，不是装饰：
   *      点击 → 加 .is-refreshing（图标转）→ 禁用（防连点）→ finally 复位。 */
  /* ★ 绑定写成 `$('#refreshButton')?.addEventListener(...)` —— 这条判据要守的
   * 是"点击真的接到了异步处理器上"（拿得到完成时机、才有地方复位），
   * 不是"有没有写可选链"，所以 `?*` 一起收进来。 */
  assert.match(app, /\$\('#refreshButton'\)\?*\.addEventListener\('click', async \(\) => \{/,
    '刷新按钮的点击处理器应为首个 await 的异步函数（否则拿不到完成时机，也就无处复位）');
  assert.match(app, /button\.classList\.add\('is-refreshing'\)/, '点击后应进入刷新态');
  assert.match(app, /button\.disabled = true;/, '刷新期间应禁用按钮防连点');
  assert.match(app, /finally \{\s*\n\s*button\.classList\.remove\('is-refreshing'\);\s*\n\s*button\.disabled = false;/,
    '复位必须放在 finally —— 出错时若不复位，按钮会永远转下去（比没有反馈更糟）');
  assert.match(css, /\.refresh-button\.is-refreshing \.refresh-icon\{ animation: spin /,
    '刷新态应让图标转起来（复用已有的 spin 关键帧，不新增动画）');
});

test('overview hides the idle progress panel and lets quick actions take the full row', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  const css = read('renderer/styles.css');
  assert.match(html, /class="panel progress-panel" hidden/);
  assert.match(app, /function setProgressPanelVisible/);
  assert.match(app, /setProgressPanelVisible\(percent > 0 \|\| failed\)/);
  assert.match(app, /classList\.toggle\('is-solo', !visible\)/);
  assert.match(css, /\.overview-bottom\.is-solo\{ grid-template-columns: minmax\(0,1fr\); \}/);

  /* ★ 第 28 轮（用户第 7 条「打开 Tunnel 控制台占用面积过大」）：
   * 「第 3 个按钮跨整行」只该在两列布局下生效，is-solo 三列下必须中和。
   *
   * 实测数据（1360 窗口，进度面板隐藏 → is-solo 三列）：
   *   修复前：切换工作目录 338×55 / 创建 MCP 338×55 / **Tunnel 控制台 1029×55**
   *           → 第三个占列表 46.5%，是另外两个的 3 倍
   *   修复后：三者各 338×55，各占 33%
   * 「常用操作」面板面积 205738 → 138580 px²（高度 119 → 55）。
   *
   * 这条断言必须**成对**存在：只断言"两列下跨整行"会漏掉 is-solo 的反向覆盖，
   * 而漏掉它正是上面那组数字的来源。
   *
   * 另一边用 :where() 压特异性：反向规则多带 .overview-bottom.is-solo 两个类，
   * 若用普通写法是 [0,5,1]，超出契约上限 [0,3,0]（棘轮实测拦下：139 → 140）。
   * :where() 特异性恒为 0，两边都回到 [0,3,0]，靠书写顺序决胜。 */
  assert.match(css, /\.action-list > :where\(button\):last-child:nth-child\(odd\)\{ grid-column: 1 \/ -1; \}/,
    '两列布局下最后一个奇数按钮应跨整行收尾（避免半行孤岛）');
  assert.match(css, /:where\(\.overview-bottom\.is-solo\) \.action-list > :where\(button\):last-child:nth-child\(odd\)\{ grid-column: auto; \}/,
    '★ is-solo 三列下必须把 grid-column 还原 —— 否则次要的「打开 Tunnel 控制台」会独占 46.5% 宽度');
  /* 特异性必须留在契约内：反向规则不得用普通类写法（那会到 0,5,1） */
  assert.doesNotMatch(css, /\.overview-bottom\.is-solo \.action-list > button:last-child/,
    '反向规则不得丢掉 :where() —— 普通写法特异性 0,5,1 超出上限 0,3,0');
});

test('sidebar keeps a single readiness line instead of duplicating overview status', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  for (const id of ['sideWorkspace', 'sideMcp', 'sideTunnel', 'sideConnectionLabel']) {
    assert.doesNotMatch(html, new RegExp(`id="${id}"`), `${id} 应已从侧栏移除`);
    assert.doesNotMatch(app, new RegExp(id), `${id} 的 JS 引用应已移除`);
  }
  assert.doesNotMatch(html, /mini-stats/);
  assert.match(html, /id="sideRuntimeText"/);
});

test('the sidebar is grouped, and the guide sits alone at the bottom', () => {
  /* 第 30 轮用户原话：
   *   「设置的侧边任务栏UI需要优化，日常、配置和维护需要重新设计，
   *     接入指南建议放到最下面单独列出；最下面的"状态检查在本机完成，
   *     不消耗聊天额度"这段话直接删掉」
   *
   * 改前真机基线（_verify-round30-item1.js + item1-sidebar-baseline.json）：
   *   · 侧栏高 822，`.nav-list` 只有 414（50.4%），下方凭空留 216px 空白
   *   · 「接入指南」混在「配置」组**第三个**位置 —— 一次性引导读物
   *     和每天要用的「运行与连接 / 工作区与权限」并列，位置错配
   *   · `.sidebar-footer` 单独占 61px，内容只有那句免责说明
   *
   * 改后真机读数（第30轮实测/item1-verify.json）：
   *   itemCount 8 / lastItem "guide" / 导航占高 84.1% / gapToNavListBottom 0
   *
   * ★ 注意断言的是**结构关系**不是关键词 —— 否则把 guide 塞回中间、
   *   或让 .nav-bottom 不再是最后一个，都能照样通过。
   *   本项目已有教训：只搜关键词 = 假护栏（见项目铁律 §2）。 */
  const html = read('renderer/index.html');
  const css = read('renderer/styles.css');
  const htmlCode = html.replace(/<!--[\s\S]*?-->/g, '');
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');

  /* ① 分组标签按「日常 / 设置 / 扩展 / 帮助」的次序出现，且都在导航容器内。
   *    原意图（"分组按用户此刻要做什么重划，且标签必须真的在导航容器内"）
   *    没变，只是重划后的组名从「日常/配置/维护/帮助/高级」变成了
   *    「日常（总览·任务）/ 设置（连接与文件·偏好设置）/ 扩展（技能·提示词·记忆）
   *      / 帮助（故障排查·关于我们，吸底）」—— 「高级」不再是独立组，
   *    它的入口现在是隐藏兼容节点（见布局归属清单）。 */
  const navStart = htmlCode.indexOf('<nav class="nav-list"');
  const navEnd = htmlCode.indexOf('</nav>', navStart);
  assert.ok(navStart > -1 && navEnd > navStart, '侧栏应有 .nav-list 导航容器');
  const nav = htmlCode.slice(navStart, navEnd);
  const groupOrder = [...nav.matchAll(/<span class="nav-group-label"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(groupOrder, ['日常', '设置', '扩展', '帮助', '开始使用'],
    '分组标签应包含「日常 / 设置 / 扩展 / 帮助 / 开始使用」五项且保持此顺序');

  /* ② 可见导航项的次序必须稳定。
   *    ★ 判据取"不带 hidden 的项"而不是"文件里搜得到 data-page" ——
   *      隐藏兼容节点（guide/logs/advanced 等空按钮）不是用户入口，
   *      把它们算进来会得出"侧栏有 12 项"的假读数（这正是本次界面重写里
   *      "把旧元素塞进 hidden 桩让断言命中"的那一类假绿）。 */
  const visibleItems = [...nav.matchAll(/<button class="nav-item(?: active)?" data-page="([a-z]+)"(?![^>]*\bhidden\b)/g)]
    .map((m) => m[1]);
  assert.deepEqual(visibleItems.filter((p) => p !== 'guide'),
    ['overview', 'task', 'deploy', 'settings', 'skills', 'prompts', 'memory', 'health', 'about'],
    '可见导航项的次序应稳定（日常：总览/任务 → 设置：连接与文件/偏好设置 → 扩展：技能/提示词/记忆 → 吸底帮助：故障排查/关于我们）');
  /* ★ 这条「接入指南须有可见入口」的断言**保留为"可见入口"断言**。
   *   第 30 轮记录的决定是「接入指南从配置组移出，放到侧栏最下面单独成区」。
   *   界面重写中间态一度把它写成了一个**隐藏空按钮**（隐藏的空按钮不是入口：
   *   用户点不到、也搜不到），本测试当时为此保持红着 ——
   *   主 agent 已按该决定恢复成可见入口（现挂在最下方「开始使用」组）。
   *   保留这条断言的理由：它是"入口可见性"的护栏，防止再被降级成隐藏桩。 */
  assert.ok(visibleItems.includes('guide'),
    '★ 接入指南必须有可见的侧栏入口 —— 隐藏空按钮不算入口（第 30 轮决定：最下面单独成区）');

  const allItems = [...nav.matchAll(/class="nav-item(?: active)?" data-page="([a-z]+)"/g)].map((m) => m[1]);
  assert.equal(allItems.filter((p) => p === 'guide').length, 1, '接入指南只应有一个入口节点（不得出现重复入口）');

  /* ③ ★ 分成"独立成区、贴底"的那一块：`.nav-bottom` 必须包住帮助组与接入指南。
   *    原判据用 `nav.indexOf('</span>', bottomStart)` 找块尾 ——
   *    现在 .nav-bottom 内部多了一层 .nav-group-label（帮助），
   *    第一个 `</span>` 落在标签上会把块截短，所以改成配对扫描。 */
  const bottomStart = nav.indexOf('<span class="nav-bottom">');
  assert.ok(bottomStart > -1, '帮助与接入指南应包在 .nav-bottom 里（独立成区、贴底）');
  const spanPairFrom = (text, from) => {
    const re = /<span\b[^>]*>|<\/span>/g;
    re.lastIndex = from;
    let depth = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      depth += m[0].startsWith('</') ? -1 : 1;
      if (depth === 0) return m.index;
    }
    return -1;
  };
  const bottomEnd = spanPairFrom(nav, bottomStart);
  assert.ok(bottomEnd > bottomStart, '.nav-bottom 应能配对闭合');
  const bottom = nav.slice(bottomStart, bottomEnd);
  assert.match(bottom, /data-page="health"/, '故障排查应在 .nav-bottom 内（帮助组吸底）');
  assert.match(bottom, /data-page="about"/, '关于我们应在 .nav-bottom 内（帮助组吸底）');
  assert.match(bottom, /data-page="guide"/, '接入指南应在 .nav-bottom 内（第 30 轮：放到侧栏最下面单独成区）');
  /* .nav-bottom 之后不得再有任何导航项 —— 否则"贴底"不成立 */
  const afterBottom = nav.slice(bottomEnd);
  assert.doesNotMatch(afterBottom, /class="nav-item(?: active)?"/,
    '.nav-bottom 之后不应还有导航项（那会把它挤离底部）');

  /* ④ 那句免责说明必须消失（元素 + 文案双重） */
  assert.doesNotMatch(htmlCode, /sidebar-footer/,
    '.sidebar-footer 整块应已删除 —— 它的内容只有那句免责说明');
  assert.doesNotMatch(htmlCode, /不消耗聊天额度/,
    '「状态检查在本机完成，不消耗聊天额度」应已删除');
  assert.doesNotMatch(cssCode, /\.sidebar-footer/,
    'styles.css 不应留无元素的 .sidebar-footer 规则');

  /* ⑤ 导航容器必须吃掉剩余空间，底部区靠 margin-top:auto 贴底 ——
   *    这是"216px 空白"能被消掉的机制本身，不能只看那一屏的读数。 */
  const navListRules = [...cssCode.matchAll(/^\.nav-list\{([^}]*)\}/gm)].map((m) => m[1]);
  assert.equal(navListRules.length, 1, '.nav-list 应只有一处定义（重复选择器会撞 no-duplicate-selectors）');
  assert.match(navListRules[0], /flex:\s*1/, '.nav-list 应 flex:1 吃掉剩余高度');
  assert.match(navListRules[0], /min-height:\s*0/, 'flex 子项要 min-height:0 才能在窄屏正确收缩');
  const bottomRules = [...cssCode.matchAll(/^\.nav-bottom\{([^}]*)\}/gm)].map((m) => m[1]);
  assert.equal(bottomRules.length, 1, '.nav-bottom 应只有一处定义');
  assert.match(bottomRules[0], /margin-top:\s*auto/,
    '.nav-bottom 应 margin-top:auto 贴到侧栏底部（否则又会浮在半空）');
  assert.match(bottomRules[0], /border-top:\s*1px solid var\(--border\)/,
    '底部区要有分隔线，才能和上面三组"分开"');

  /* ⑥ 分组标签必须是"弱化的层级标记"，不能和导航项同色同权 ——
   *    改前两者都是 --muted，读起来标签就像第 4 个按钮。
   *    ★ 原判据断言"只有一处定义"。现界面在紧凑层里又写了一份（后写者胜），
   *      两处并不冲突（都是 --muted-2），但重复选择器本身是"两处真相"的气味，
   *      已列入需要代码侧处理的清单。这里把判据改成**语义判据**：
   *      每一处定义都必须用更弱的 --muted-2，且胜出的那一处必须
   *      与 .nav-item 的 --muted 拉开层级。 */
  const labelRules = [...cssCode.matchAll(/^\.nav-group-label\{([^}]*)\}/gm)].map((m) => m[1]);
  assert.ok(labelRules.length >= 1, '.nav-group-label 应至少有一处定义');
  for (const rule of labelRules) {
    assert.match(rule, /color:\s*var\(--muted-2\)/,
      `每一处 .nav-group-label 都必须用更弱的 --muted-2：${rule.trim()}`);
  }
  const labelRule = labelRules[labelRules.length - 1]; // 同特异性下后写者胜
  assert.match(labelRule, /padding-top:/,
    '组间距离靠 padding-top，否则三组会挤成一坨');
  const navItemRule = cssCode.match(/^\.nav-item\{([^}]*)\}/m)?.[1] || '';
  const labelColor = labelRule.match(/color:\s*([^;]+)/)?.[1].trim();
  const itemColor = navItemRule.match(/color:\s*([^;]+)/)?.[1].trim();
  assert.ok(labelColor && itemColor && labelColor !== itemColor,
    `分组标签必须比导航项更弱（同色会把标签读成第 4 个按钮）：标签 ${labelColor} vs 导航项 ${itemColor}`);
});

test('styles.css consumes scale tokens instead of scale literals', () => {
  const css = read('renderer/styles.css');
  const tokens = read('renderer/design-tokens.css');
  /* ★ 先剥掉 CSS 注释再断言。
   *   本项目已在"注释里引用了要被删掉的写法"这个坑上栽了 13 次 ——
   *   每次都是：护栏要求"某种写法必须消失"，而**解释为什么删掉它**的注释
   *   逐字包含那个写法。注释是给人看的解释，不该为了过测试而绕着写。
   *   根治办法就在这里：断言前把注释拿掉，注释里就可以放心引用旧写法。 */
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // 尺度字面量必须走令牌。护栏的 declaration-property-value-allowed-list
  // 只会接受 var(--fs-*) / var(--radius-*)，这里再固化一次，
  // 因为测试比护栏更早、更确定地失败。
  assert.doesNotMatch(code, /font-size:\s*\d+px/);
  assert.doesNotMatch(code, /border-radius:\s*\d+px/);
  for (const t of ['--fs-xs', '--fs-sm', '--fs-base', '--fs-md', '--fs-lg', '--fs-xl',
    '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-pill']) {
    assert.match(css, new RegExp(`var\\(${t}\\)`), `${t} 应已被消费`);
    assert.match(tokens, new RegExp(`^\\s*${t}:`, 'm'), `${t} 应在令牌文件中定义`);
  }
  // 兼容旧名 --radius 已删除：令牌名不再有新旧两套
  assert.doesNotMatch(code, /var\(--radius\)/);
  assert.doesNotMatch(tokens, /^\s*--radius:/m);
});

test('browser.css only consumes tokens it declares itself, never the design-system layer', () => {
  const tokensHtml = read('renderer/index.html');
  const browserHtml = read('renderer/browser.html');
  const browserCss = read('renderer/browser.css');
  /* 这条断言是"别好心办坏事"的护栏，原版比现在严：
   * browser.html 只加载 browser.css，design-tokens.css 没被引入，
   * 所以 browser.css 里任何 var(--xxx) 都是**未定义变量** ——
   * 未定义变量会让整条声明失效（不是回退到默认值，而是丢失），直接破坏渲染。
   * 原版因此一刀切禁止 browser.css 出现 var(--fs-*) / var(--radius-*) 等。
   *
   * 第 28 轮把这条规则**精确化**了。原因：
   *   本轮要重做导航按钮、任务进度区、工作区控件三块，直接写字面量会新增
   *   棘轮违规（新增 hex 必被拦），所以给 browser.css 补了一层**自己的**
   *   :root 令牌（--control-* / --track / --sunken / --fs-* / --radius-* …），
   *   使用点改引用它们 —— 实测棘轮 178 → 139。
   *
   * 关键区别（一刀切禁令会把这个正确做法也拦下）：
   *   ✗ var(--surface) / var(--chrome-bg)  → 这些只在 design-tokens.css 里声明，
   *     browser.css 引用它们仍是"未定义变量"，依然危险 → 继续禁止；
   *   ✓ var(--control-bg) / var(--fs-sm)   → browser.css **自己**在 :root 里声明了，
   *     引用是安全的 → 允许，但必须真的声明过（下面逐个核对）。
   *
   * 所以判据从"禁止所有 var(--fs-*)"升级为
   * "禁止引用**本文件没声明**的令牌"。这比原来更能抓住真问题：
   * 原版无法区分"借用别的层的令牌"和"用自己的令牌"，只能全禁。 */
  assert.match(tokensHtml, /href="design-tokens\.css"/);
  assert.doesNotMatch(browserHtml, /design-tokens\.css/);

  const root = browserCss.match(/:root\{[\s\S]*?\}/)?.[0] || '';

  /* ① 只在 design-tokens.css 里声明的那批「设计系统专属」令牌，继续全禁 ——
   *    引用它们仍然是未定义变量。 */
  for (const t of ['surface', 'chrome-', 'btn-primary-', 'sp-', 'node-bg', 'console-bg', 'brand-']) {
    assert.doesNotMatch(browserCss, new RegExp(`var\\(--${t}`),
      `browser.css 不能引用 --${t}*（该令牌只在 design-tokens.css 声明，未被加载）`);
  }

  /* ② 本文件用到的每一个 var() 都必须在这个 :root 块里声明过。
   *    这才是有意义的判据 —— 它同时允许"用自己的令牌"、
   *    拦住"借用没加载的令牌"，两者原本无法区分。 */
  const used = [...browserCss.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
  const undeclared = [...new Set(used)].filter((t) => !new RegExp(`\\${t}:\\s*[^;]`).test(root));
  assert.equal(undeclared.length, 0,
    'browser.css 引用了本文件未声明的令牌 —— 未定义变量会让整条声明失效：'
    + undeclared.join(', '));

  /* ③ 令牌不得指向自己。
   *    第 28 轮批量把字面量换成 var() 时，脚本把 :root 里的
   *    `--control-bg:#fff` 也一起换成了 `--control-bg:var(--control-bg)` ——
   *    这会让整组令牌失效，且**不报任何错**，是最难查的一类。
   *    这一条是那次真实事故留下的护栏。 */
  const selfRef = [...root.matchAll(/(--[a-z0-9-]+):\s*var\(\1\)/g)].map((m) => m[1]);
  assert.equal(selfRef.length, 0, `令牌不得自引用：${selfRef.join(', ')}`);

  /* 已知结构性问题（未修）：browser.css 开头自带一套**同名但不同值**的局部令牌
   * （--border / --text / --muted / --green / --red，取 ChatGPT 风格）。
   * 它与 design-tokens.css 构成两套并行令牌，违背 §一"唯一事实来源"。
   * 因两个页面各自加载、互不冲突，故不构成覆盖 bug，但属设计分裂。
   * 此处只固定现状，避免有人在不了解的情况下"顺手统一"而破坏该页。 */
  assert.match(browserCss, /--green:#10a37f/);
});

test('preformatted output reaches its sub-scale size through the --fs-pre token, never a literal', () => {
  const css = read('renderer/styles.css');
  /* 先剥注释再断言：注释里会引用示例写法（design-tokens.css 第 145 行就写了
   * `font: 10px/1.6 Consolas,monospace` 作为"以前长什么样"的说明），
   * 不剥注释的话测试会被自己的文档搞红。 */
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

  /* 1) 代码里不得再有 font: 简写的 px 字面量。
   *
   * 这条在第 27 轮之前是**不成立**的：当时本项目有 5 处 10px 与 1 处 9px
   * 写成 `font: 10px/1.6 Consolas,monospace`，stylelint 完全没报 ——
   * 因为 declaration-property-value-allowed-list 只检查 `font-size` **属性**，
   * `font` **简写**里的字号绕过了它。旧版测试因此只敢断言"保留简写形式、
   * 且不超过 12px"，等于把盲区当作既成事实接受下来。
   *
   * 第 27 轮实测证明这个盲区**可以补**（一条正则即可，见 stylelint.config.mjs
   * 的 3b 节），于是 5 处改为 var(--fs-pre)，断言也随之从"容忍字面量"
   * 升级为"禁止字面量"。 */
  const literals = code.match(/font:\s*(?:[a-z0-9]+\s+)*\d+(?:\.\d+)?px/g) || [];
  assert.equal(literals.length, 0,
    `font: 简写里的字号必须走令牌 var(--fs-pre)，不得写字面量；仍发现 ${literals.join(' / ')}`);

  /* 2) 预格式化输出全部通过令牌取值。
   *
   * ★ 第 29 轮：从 5 处降为 **4 处** —— 日志页（.log-output）被移出这个集合。
   *
   * 移出的理由不是"想让测试变绿"，而是它的**分类本身就是错的**：
   *   --fs-pre(10px) 的定义是"预格式化输出专用"——构建台、命令回显、
   *   指令详情、工作树 diff，这些是机器按列对齐产生的内容，小字号换来
   *   一屏看更多行。日志不是：它是给人顺着读的时间线，每行一句自然语言。
   *   第 29 轮实测用户第一反应就是"字体太小了"（10px 中文）。
   * 所以日志改用 --fs-base(14px)，--fs-pre 的语义边界反而更清晰了：
   * 它现在只服务真正的预格式化区域，一个不含糊。
   *
   * 下界 4 而不是 3：这 4 处都是**同一类**东西（等宽输出区），
   * 若哪天有人再删一处，应当是被这条断言拦下来重新讨论分类，
   * 而不是默默通过。 */
  const tokenUses = code.match(/font:\s*var\(--fs-pre\)\/[\d.]+ [^;}]+/g) || [];
  assert.equal(tokenUses.length, 4,
    `预格式化输出区应恰好有 4 处使用 var(--fs-pre)（日志页已于第 29 轮改用 --fs-base），实际 ${tokenUses.length} 处`);

  /* 2b) 反向护栏：日志页必须**不再**是预格式化输出。
   * 只断言总数会漏掉"删了一处又加了一处"的等价替换 ——
   * 必须点名确认日志那一条规则真的不在 --fs-pre 集合里。 */
  const logOutputRule = code.match(/\.log-output\{[^}]*\}/)?.[0] || '';
  assert.ok(logOutputRule, 'styles.css 应仍有 .log-output 规则');
  assert.doesNotMatch(logOutputRule, /--fs-pre/,
    '日志页不是预格式化输出（它是给人读的记录表），不得再用 --fs-pre');
  assert.match(logOutputRule, /font-size:\s*var\(--fs-base\)/,
    '日志页字号应为 --fs-base(14px)——第 29 轮用户明确反馈 10px「字体太小」');
  /* 同一条规则里不得再出现 font: 简写 —— 简写会把 font-size 一起覆盖掉，
   * 两条并存时会静默取简写的值（简写在后则 invalid 整条失效）。 */
  assert.doesNotMatch(logOutputRule, /font:\s/,
    '.log-output 不得同时保留 font: 简写与 font-size：简写会吞掉字号声明');

  /* 3) 令牌只声明一次，值为 10px。 */
  const tokens = read('renderer/design-tokens.css');
  const declared = tokens.replace(/\/\*[\s\S]*?\*\//g, '').match(/--fs-pre:\s*\d+px/g) || [];
  assert.equal(declared.length, 1, `--fs-pre 应只声明一次，实际 ${declared.length} 次`);
  assert.match(declared[0], /10px/);

  /* 4) "低于 12px 的字号"在本项目只有三档，且必须逐一列名。
   *    这让"有没有人偷偷用 9px"变成一个可查询的事实，而不是靠人工巡检。
   *
   *    ★ 第 41 轮修：原判据用 `--fs-[a-z]+` 匹配令牌名，而 `--fs-11` /
   *      `--fs-11-5` 这类**数值名含数字**，正好被正则漏掉 —— 于是
   *      "本项目只有一档低于 12px"这句话在 DESIGN.md 里是错的、在这里是绿的
   *      （文档与测试各自绿着，而事实是 3 档）。护栏漏判比不判更坏：
   *      它把这个错误结论变成了"已验证"。
   *    现在：正则认数值名（`[a-z0-9-]+`，并且值用 `[\d.]+px` 以便看见 11.5px），
   *    断言改为**显式列出三档** —— 新增任何低于 12px 的令牌都会被拦下，
   *    而这三档的存在理由写在 DESIGN.md 第三章（它们是历史值的显影，
   *    不是新增档位；抬到 12px 会改变渲染，属界面决策）。 */
  const subScale = (tokens.replace(/\/\*[\s\S]*?\*\//g, '').match(/--fs-[a-z0-9-]+:\s*[\d.]+px/g) || [])
    .filter((d) => Number(d.match(/([\d.]+)px/)[1]) < 12)
    .map((d) => d.split(':')[0].trim());
  assert.deepEqual(subScale, ['--fs-pre', '--fs-11', '--fs-11-5'],
    `低于 12px 的字号令牌只应有 --fs-pre / --fs-11 / --fs-11-5 这三档，实际 ${JSON.stringify(subScale)}；`
    + '若这是有意新增的档位，请同步 DESIGN.md 第三章的令牌表并说明为什么不能并入现有档');

  /* 5) ★ browser.css 绝对不能引用 --fs-pre。
   *
   * 第 28 轮起 browser.css 有了自己的 :root 令牌层（含 --fs-xs/sm/base/lg），
   * 但它**故意不含 --fs-pre** —— 这一档是"预格式化输出专用"，只服务于
   * styles.css 那 5 处等宽日志/命令回显；browser.css 里没有任何机器输出区，
   * 声明了只会变成死令牌。
   *
   * 万一有人引用它：browser.css 未声明该变量 → var() 未定义 →
   * font 简写整体在 computed-value 阶段变为 invalid → 回退到**继承值**
   * （即父元素的字号），而不是回退到 10px 或某个默认值。
   * 这跟"换个字号"完全是两回事，属于静默的样式丢失 —— 元素会以意想不到的
   * 大小渲染，且不报任何错。
   *
   * 第 27 轮用 Electron 真机核实了这条回退行为，不是照搬规范：
   *   gpt-webcodex-ui-重构/_probe-font-shorthand.js
   *   判据 1：var(--fs-pre) 与 10px 字面量的 computed 值（字号/行高/字族）完全一致
   *   判据 3：--fs-nope（未定义）时字号回退为 body 的 33px，证实"回退继承"而非"丢弃声明" */
  const browserCss = read('renderer/browser.css');
  /* 先剥注释 —— 上面这段说明本身就写着 "--fs-pre" 这个词，
   * 不剥会让这条断言被自己的文档搞红。（本项目已经四次栽在这上面，
   * 护栏正则看不见注释与代码的区别，它严格是对的。） */
  const browserCode = browserCss.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(browserCode, /--fs-pre/,
    'browser.css 不声明也不得引用 --fs-pre；引用会让整条 font 声明失效并回退到继承值');
  /* 同一条道理的另一半：它自己的字号令牌里不得出现低于 12px 的值。
   * 12px 是"给人读的正文"的下限，这条下限对两个视图一体适用 ——
   * 否则同一个视觉体系里，设置页最小 12px、主界面却可以有 10px。 */
  const browserRoot = browserCode.match(/:root\{[\s\S]*?\}/)?.[0] || '';
  const browserSubScale = (browserRoot.match(/--fs-[a-z]+:\s*\d+px/g) || [])
    .filter((d) => Number(d.match(/(\d+)px/)[1]) < 12)
    .map((d) => d.split(':')[0].trim());
  assert.deepEqual(browserSubScale, [],
    `browser.css 的字号令牌不得低于 12px（那是"给人读的正文"的下限），实际 ${JSON.stringify(browserSubScale)}`);
});


/* ============================================================================
 * CI 门禁的自守护
 * ----------------------------------------------------------------------------
 * 下面几项把"门禁成立的前提"本身变成断言。
 * 动机来自本项目的反复教训：契约与实现会悄悄脱节（DESIGN.md 第 10 行曾写着
 * "要进 CI 才能守住"，而仓库里根本没有 CI；check-contrast.js 曾声称是
 * §六.7 的检查手段，实际却在仓库外）。这类脱节不会报错，只会让守卫失效。
 * ========================================================================== */

test('CI workflow runs the three gates with the prerequisites they need', () => {
  const workflow = read('.github/workflows/verify.yml');
  const pkg = JSON.parse(read('package.json'));

  // 必须是 Windows —— 见 workflow 里的注释（tools/*.exe 是 Windows 二进制、
  // python 测试用 os.name 判定、run-python-tests.js 用 path.delimiter）
  assert.match(workflow, /runs-on:\s*windows-latest/);

  // 三个门禁都得被真正调用
  assert.match(workflow, /npm test\b/);
  assert.match(workflow, /check:css-ratchet/);
  assert.match(workflow, /check:contrast/);

  // 零下载前提：没有它，npm ci 后 require('electron') 会拉 100MB 二进制，
  // 而 tests/chat-recovery.test.js 必须能 require electron/chatViewController.js
  assert.match(workflow, /ELECTRON_OVERRIDE_DIST_PATH/);
  assert.match(workflow, /--ignore-scripts/);

  // npm scripts 里这些名字必须真的存在，否则 CI 会以"命令不存在"失败
  for (const name of ['test', 'check:css-ratchet', 'check:contrast', 'verify', 'lint:css']) {
    assert.ok(pkg.scripts[name], `package.json 缺少 script: ${name}`);
  }
});

test('the css ratchet guards the baseline file it depends on', () => {
  const ratchet = read('scripts/check-css-ratchet.js');
  const baseline = JSON.parse(read('stylelint-baseline.json'));

  // 基线必须存在且结构完整，否则门禁会在 CI 上以"缺基线"失败
  assert.equal(typeof baseline.total, 'number');
  assert.ok(baseline.counts && typeof baseline.counts === 'object');
  // items 是提示文本粒度 —— 没有它，"删一条旧的加一条新的"会互相抵消而漏过
  assert.ok(baseline.items && typeof baseline.items === 'object');
  assert.ok(Object.keys(baseline.items).length > 0,
    'items 为空会导致棘轮退化为纯计数，失去拦截能力');

  // --update 必须拒绝放宽基线，否则棘轮可被一次提交轻易绕过
  assert.match(ratchet, /拒绝更新基线/);
  assert.match(ratchet, /cur\.total > prev\.total/);

  /* 提示文本必须做归一化，剥掉行号。
   * 缺陷来源：no-duplicate-selectors 的 message 是
   *   'Duplicate selector "button", first used at line 15 (...)'
   * —— 行号会随任何无关编辑（插行、删行）漂移。
   * 第 10 轮删掉几行死选择器后，四条**原本就存在**的该规则违规
   * 被报成"新增"，门禁误报并拦住了正确改动。 */
  assert.match(ratchet, /function normalizeText/, '棘轮必须有提示文本归一化');
  assert.match(ratchet, /first used at line \\d\+/, '必须针对 first used at line 做替换');

  // 基线里不得再残留带行号的旧格式提示，否则等价性判定会失效
  for (const key of Object.keys(baseline.items)) {
    assert.doesNotMatch(key, /first used at line \d+/,
      `基线残留带行号的提示文本，会随行号漂移假报：${key}`);
  }
});

test('the contrast guard is inside the repo so CI can reach it', () => {
  const guard = read('scripts/check-contrast.js');
  const design = read('renderer/DESIGN.md');

  // 它必须解析仓库内的令牌文件（相对 __dirname），而不是硬编码仓库外路径
  assert.match(guard, /path\.resolve\(__dirname,\s*'\.\.',\s*'renderer',\s*'design-tokens\.css'\)/);
  assert.doesNotMatch(guard, /\.\.\/gpt-webcodex/);

  // 契约必须真的引用它 —— 否则又是"规则写了但没人执行"
  assert.match(design, /check:contrast/);
  assert.match(design, /scripts\/check-contrast\.js/);
});

test('DESIGN.md does not present lint:css as the gate it cannot be', () => {
  const design = read('renderer/DESIGN.md');
  // 存量 187 条时 lint:css 必然 errored，不能当门禁。
  // 第 6 行必须指向棘轮。若有人改回"由 lint:css 拦下"，这里会失败。
  assert.match(design, /check:css-ratchet/);
  assert.match(design, /永远红的门禁等于没有门禁/);
});

test('styles.css has no rules for markup that does not exist', () => {
  const css = read('renderer/styles.css');
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');

  /* 死选择器：第 10 轮清掉的三个。判据见 DESIGN.md §六.8 ——
   * 删元素时必须同时删样式，否则样式会"骗人"（读代码的人以为存在这类元素）。
   * 注意动态拼接：app.js 里用 className= / classList.add 造类名，
   * 只在 HTML 里搜会得出错误的"死"结论。 */
  for (const cls of ['ghost-button', 'settings-list']) {
    const inHtml = html.includes(cls);
    const inJs = new RegExp(`['"\`][^'"\`]*\\b${cls}\\b`).test(app);
    assert.ok(!inHtml && !inJs, `${cls} 已无对应元素，样式规则不应保留`);
    assert.doesNotMatch(css, new RegExp(`\\.${cls}\\b`), `styles.css 不应再有 .${cls}`);
  }

  // .brand-mark 内部装的是 <svg>，没有任何 <span>，故 span 计数器选择器永远不匹配
  assert.doesNotMatch(css, /\.brand-mark\s+span/);
  assert.match(html, /class="brand-mark[^"]*"><svg/, '.brand-mark 的内容应是 svg（这正是删除 span 规则的原因）');
  // 但 .brand-mark 本身仍在用，其有效规则必须保留
  assert.match(css, /\.brand-mark\{/);
  assert.match(css, /\.brand-mark svg\{/);
  assert.match(css, /\.brand-mark\.large\{/);
});

test('the brand mark is not squeezed by unrelated class-name collisions', () => {
  const css = read('renderer/styles.css');
  const html = read('renderer/index.html');

  /* 第 30 轮（用户第 6 条「图标还是偏移了」）真机实测抓到的真 bug：
   *
   *   `.brand-mark.large` 里的 `large` 和"按钮放大变体"的 `large` 是**两个同名类**。
   *   当时有一条无限定的
   *     .large{ min-height: 42px; padding: 0 19px; }
   *   本意只针对 .primary-button.large / .secondary-button.large，
   *   却把 54px 定宽的徽标一起命中了：徽标 content-box 被压到 16px，
   *   47px 的 svg 居中后**水平外溢 19px、垂直正常**。
   *
   *   ★ 实测读数（DOM 直接量的，不是眼看）：
   *       box 54×54 / svg 47×47 / svg 相对方块 左偏 +19px 上偏 +3.5px
   *       3.5 = (54-47)/2 恰好是正常居中值 → 证明"居中没坏，是被 padding 挤歪的"
   *       19 正好等于那条 padding 值 → 因果关系锁死
   *
   *   ★ 断言写法说明：不能只断言"没有裸的 .large 规则" ——
   *     那挡不住把同一条碰撞挪到别的选择器上（比如 .brand-mark 的页级覆盖）。
   *     这里断言的是**根因被切断**：`.large` 这类放大变体必须带按钮前缀。
   *     用逐行扫描而不是全文正则：`padding: 0 19px` 是否"属于 .large"要看行内，
   *     跨行配对会在压缩过的 CSS 上误判。
   *
   *   ★★ 必须先整体剥掉 CSS 注释再逐行扫：上面这段解释里**逐字引用了那条被删的
   *      旧规则**（`.large{ min-height: 42px; padding: 0 19px; }`），
   *      不剥注释就会把"解释问题的注释"当成问题本身。
   *      本项目已在同一个坑上栽了 12 次 —— 每次都是"注释里引用了要被删掉的写法"。
   *      注意不能逐行剥：CSS 注释是跨行的，得先把 /* ... *​/ 整段拿掉。
   *      （这也意味着注释里可以放心引用旧写法，不必为了过测试而删掉解释。） */
  const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const offenders = cssNoComments.split('\n')
    .map((line, i) => ({ line: line.trim(), no: i + 1 }))
    .filter(({ line }) => {
      // 只看选择器部分，且不把令牌定义/注释里的 .large 算进来
      const sel = line.split('{')[0];
      if (sel.includes('brand-mark') || sel.includes('boot-logo')) return false;
      return /(^|[,\s])\.large\s*($|[,{])/.test(sel);
    })
    .map(({ line, no }) => `${no}: ${line}`);
  assert.deepEqual(offenders, [],
    `「.large」放大变体必须限定到按钮上下文（.primary-button.large 等），不得有无限定规则：\n${offenders.join('\n')}`);

  // 反向确认：限定后的那组规则确实存在，别把"删干净"当成"修好了"
  assert.match(css, /\.primary-button\.large,\s*\.secondary-button\.large,\s*\.danger-button\.large\{/,
    '按钮的放大变体规则应保留并限定前缀');

  // 徽标尺寸四处同源：三处 svg 的几何必须一致（详见 tests/icon-source.test.js 的真源比对）
  assert.equal((html.match(/class="brand-mark/g) || []).length, 2);
  assert.equal((html.match(/class="boot-logo"/g) || []).length, 1);
});

test('the joined input-and-button control declares its seam on the winning side of the cascade', () => {
  const html = read('renderer/index.html');
  const raw = read('renderer/styles.css');
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

  /* 第 30 轮（用户第 3 条「运行通道密钥的输入框和后面的确认键中间还有缝隙」）。
   *
   * ★ 实测先排除了一个错误方向：几何间隙 gapPx = **0.000**、垂直偏移 0、高度差 0。
   *   所以"缝隙"不是布局间距，去调 grid gap 是治错地方。
   *   真正的两个成因（都是 DOM 量的）：
   *     · input  圆角实测 "6px"（四角全圆），本该是 "6px 0px 0px 6px"
   *     · input  还有一条 0.667px 边框，而 button 没有 → 拼接处一道竖向断茬
   *   二者叠加使拼接处露出承载背景的月牙形 + 一条线，读作"有缝"。
   *
   * ★ 而 input 圆角为什么会是四角全圆 —— 这条路才是要守的东西：
   *   `.input-action input{border-radius: 6px 0 0 6px}` 与
   *   `.field input{...border-radius: 6px}` **具体度都是 (0,1,1)**，
   *   同权重拼"来源顺序"，而后者排在文件更靠后的紧凑层 → 前者**从未生效**。
   *   这是"写了但永远不会生效的死规则"，而且完全静默。
   *
   * ★ 所以这张护栏守的不是"某处写着 6px 0 0 6px"，而是**覆盖关系**：
   *     ① 声明拼接圆角的那条规则必须排在 `.field input` 之后（否则又被吃掉）；
   *     ② `.input-action input` 这条选择器只能出现一次
   *        （出现两次 = 又回到"靠顺序赌胜负"的老路，而这正是 bug 的成因）；
   *     ③ 拼接缝要去掉边框断茬（border-right: 0）；
   *     ④ 另一侧（button）必须保持左直右圆，否则两边圆角会互相打架。
   *   只断言 ①④ 里的数值会被"把期望抄进断言"骗过，所以逐条都指向**结构性质**。 */
  assert.match(html, /<div id="runtimeKeyInputRow"[^>]*hidden/,
    '更换密钥是一个展开抽屉：默认收起（否则输入框会常驻在设置页上）');

  /* ★ 界面重写把「输入框 + 确认键」的拼接控件改成了
   *   「输入框 + 保存/取消」的独立 flex 行（.input-action 那套拼接已整体取消），
   *   所以原来那 4 条关于"拼接圆角谁靠后谁赢"的断言失去了落点。
   *   原意图一字未改：**拼接处不得出现可见的缝隙/断茬**。
   *   新结构下它由三件事保证，断言就此挪过去：
   *     ① 间距必须**显式声明**（gap > 0），而不是靠两条不同的边框去对齐
   *        —— 旧 bug 的读法正是"0 间距 + input 有边框而 button 没有"；
   *     ② 三个控件各自保持**完整圆角**（不再有"单侧 0 圆角"的拼接件）；
   *     ③ 不再出现 border-right:0 这类"削掉一侧边框"的拼接手法。
   *   注意：`.input-action` 的三条旧规则现已零元素，仍留在 styles.css 里
   *   （属"零元素死规则"，已列入需要代码侧处理的清单；本测试不替代码做主）。 */
  const keyRow = html.match(/<div id="runtimeKeyInputRow"[\s\S]*?<\/div>\s*<small/)?.[0] || html.match(/<div id="runtimeKeyInputRow"[\s\S]*?<\/small>/)?.[0] || '';
  assert.ok(keyRow, '应能找到「通道密钥 (Runtime API Key)」的输入行（#runtimeKeyInputRow）');
  assert.match(keyRow, /id="runtimeKeyInput"/, '输入行内应有密钥输入框');
  assert.match(keyRow, /id="saveRuntimeKey"/, '输入行内应有保存按钮');
  assert.match(keyRow, /id="cancelChangeKeyBtn"/, '输入行内应有取消按钮');

  const flexRow = keyRow.match(/<div style="([^"]*display:\s*flex[^"]*)"[^>]*>[\s\S]*?id="runtimeKeyInput"/)?.[1] || '';
  assert.ok(flexRow, '输入框与按钮必须同处一个 flex 行 —— 拼接控件（.input-action）已取消');
  const gapPx = Number((flexRow.match(/gap:\s*(\d+(?:\.\d+)?)px/) || [])[1]);
  assert.ok(gapPx > 0,
    `★ 输入框与按钮之间必须有显式且非零的间距（实得 gap=${flexRow}）——`
    + '旧 bug 的读法就是"0 间距 + 两条不同边框拼在一起"');
  assert.match(flexRow, /align-items:\s*center/,
    '同一行内三个控件必须垂直居中对齐，否则拼接处会上下错位');

  assert.doesNotMatch(keyRow, /border-right:\s*0|border-left:\s*0/,
    '不得再用"削掉一侧边框"的拼接手法 —— 那正是竖向断茬（用户读作"中间有条缝"）的成因');
  assert.doesNotMatch(keyRow, /id="runtimeKeyInput"[^>]*border-radius:\s*[^;"]*\b0\b/,
    '输入框必须是完整圆角的独立控件，不得再做"单侧 0 圆角"的拼接件'
    + '（拼接件在承载背景上会露出月牙形，且圆角归属要靠 cascade 顺序赌）');
  assert.match(keyRow, /class="primary-button btn-sm" id="saveRuntimeKey"/,
    '保存按钮用普通整圆角按钮，不与输入框共用一条边');
  const settingInputRule = css.match(/\.setting-input\s*\{[^}]*\}/)?.[0] || '';
  assert.match(settingInputRule, /border-radius:/,
    '输入框的圆角来自共享的 .setting-input 规范（单一来源），而不是本地半圆角覆写');
});

test('the global refresh and start buttons appear only on the pages that own them', () => {
  const app = read('renderer/app.js');
  const html = read('renderer/index.html');
  const code = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

  /* ★ 这条护栏是补上的一个**真空白**。
   *
   * 第 29 轮（用户第 5 条）把顶栏「刷新」「启动服务」从 8 个页面收窄到 4 个，
   * 但当时**没有为收窄写任何测试** —— 于是第 30 轮用户又必须重新提一次：
   *   「4. 工作区与权限上面为什么还有"刷新"和"启动服务"？」
   *   「5. 诊断与修复上面为什么还有"刷新"和"启动服务"？」
   * 同一个问题被用户提两次，根因就是"结论只写在注释里、没有可执行的判据"。
   * 注释会被后来的人（包括我自己）漏读，测试不会。
   *
   * ★ 判据取"结构"而不是"抄一份表"：
   *   断言"overview 是 true"只是把期望抄进测试，表一改它照样能过（只要同步改测试）。
   *   这里断言的是**可推导的性质**：
   *     ① 判据表必须与 pageMeta 的页面集合完全一致 —— 漏一个页面，
   *        它就会回落到 applyTopActions 的默认值（默认是显示）；
   *     ② 存在一张集中判据表，且 applyTopActions 真的按它执行
   *        （否则又是"规则写了但没人用"）；
   *     ③ 被收掉按钮的页面必须**各自另有**重载入口 —— 收起不等于砍掉能力。
   *        这是本项目反复强调的："降级而非删除"要能被验证。 */
  const table = code.match(/const TOP_ACTION_PAGES = \{([\s\S]*?)\n\};/);
  assert.ok(table, '应存在集中的 TOP_ACTION_PAGES 判据表（不要在十几个页面里散着写）');
  const rows = {};
  /* ★ 行形状已从 { refresh, start } 扩成 { refresh, start, save }
   *   （部署页的「保存设置」也改成按页出现），所以解析要带上 save。 */
  for (const m of table[1].matchAll(/(\w+):\s*\{ refresh: (true|false), start: (true|false), save: (true|false) \}/g)) {
    rows[m[1]] = { refresh: m[2] === 'true', start: m[3] === 'true', save: m[4] === 'true' };
  }
  const pages = Object.keys(rows);
  const metaKeys = [...(code.match(/const pageMeta = \{([\s\S]*?)\n\};/)?.[1] || '')
    .matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
  /* ★ 第 41 轮重锚：这里原本写死 `metaKeys.length >= 13`。
   *   13 是"当时有几个页面"的快照，而这条判据从来不是"必须有 13 个"，
   *   而是"每个真实页面都要有标题/说明，一个都不能漏"。空壳页面
   *   （workspace / logs / advanced）删掉后，写死的数字立刻变成假红。
   *   新判据：pageMeta 的键集合必须与 index.html 里 data-page-view 的集合**完全相等** ——
   *   删了页面没删 meta、或加了页面忘了加 meta，两个方向都会红。 */
  const htmlPages = [...new Set(
    [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/data-page-view="([\w-]+)"/g)].map((m) => m[1])
  )];
  assert.ok(metaKeys.length > 0, '应能从 pageMeta 读出页面集合');
  assert.deepEqual(metaKeys.slice().sort(), htmlPages.slice().sort(),
    'pageMeta 必须与真实页面一一对应：'
    + `meta=[${metaKeys.join(', ')}] / 页面=[${htmlPages.join(', ')}]`);
  assert.deepEqual(pages.sort(), metaKeys.sort(),
    '判据表必须与 pageMeta 的页面集合完全一致 —— 漏一个页面就会让它回落到默认值（默认是显示）');

  const withRefresh = pages.filter((p) => rows[p].refresh).sort();
  assert.ok(withRefresh.length > 0, '至少要有一页保留顶栏「刷新」（全局重读快照的入口不能消失）');
  /* 「启动服务」不得在没有「刷新」的页面上孤立出现 —— 一个残缺的工具栏
   * 比两个按钮都收起更难理解（保留了原来"同进同出"的推导）。 */
  for (const p of pages.filter((p) => rows[p].start)) {
    assert.equal(rows[p].refresh, true,
      `${p} 上有「启动服务」却没有「刷新」—— 工具栏会看起来是残缺的`);
  }
  /* ★ 现判据表里没有任何页面拥有「启动服务」→ #topStartButton 恒定 hidden。
   *   原意图「收起不等于砍掉能力」在这里必须用**替代入口**来兑现：
   *   启动服务的可见入口必须仍在首页（#overviewHeroActionBtn）。 */
  if (pages.every((p) => !rows[p].start)) {
    assert.match(html, /id="overviewHeroActionBtn"[^>]*>启动服务</,
      '顶栏「启动服务」在所有页面收起后，启动入口必须仍在首页可见 —— 能力不能随按钮一起消失');
  }

  // ② 判据表必须被执行
  assert.match(code, /const rule = TOP_ACTION_PAGES\[page\] \|\| \{ refresh: true, start: false, save: false \};/,
    'applyTopActions 应按这张表执行；漏了这张表，表就只是文档');
  assert.match(code, /refresh\.hidden = !rule\.refresh;/, '「刷新」应按判据隐藏');
  assert.match(code, /start\.hidden = !rule\.start;/, '「启动服务」应按判据隐藏');
  assert.match(code, /save\.hidden = !rule\.save;/, '「保存设置」也应按判据隐藏（新增的 save 列）');

  /* ③ 收掉按钮的页面必须各有替代入口（能力不能跟着一起消失）。
   *    ★ 第 41 轮：workspace / logs 两个空壳页面已删除（内容分别并进
   *      「运行与连接」与「故障排查」），它们那一行随之删除 ——
   *      同时**加一条反向断言**：这张表里不得再出现已不存在的页面，
   *      否则删页面时留下的行会变成永远不执行的死判据
   *      （"看着有护栏，其实一次都没跑"）。
   *    ★ 项目上下文的「重新读取」入口不再是"替代入口"：它现在挂在
   *      「运行与连接」页的 .panel-title 里（普通功能，不进开发者选项），
   *      由「只剩一个文字刷新」那条护栏直接守。 */
  const alternatives = {
    health: ['inspectHealth', 'repairHealth', 'refreshLogs'],
    task: ['refreshTaskState'],
    guide: ['refreshCodingToolsGuide']
  };
  for (const page of Object.keys(alternatives)) {
    assert.ok(page in rows,
      `替代入口表里的 ${page} 已不是页面 —— 删页面时必须同步删掉这一行，`
      + '否则这条判据永远不会执行（假护栏）');
  }
  for (const [page, ids] of Object.entries(alternatives)) {
    assert.equal(rows[page].refresh, false, `${page} 的顶栏刷新应已收起`);
    for (const id of ids) {
      assert.match(html, new RegExp(`id="${id}"`),
        `${page} 收起了顶栏刷新，但缺少替代入口 #${id} —— 收起不等于砍掉能力`);
    }
  }
});

test('removed UI vocabulary does not come back', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');

  /* 「一键」系列已按 DESIGN.md §六.9 的术语表废弃：
   *   「一键启动」→「启动服务」（顶栏按钮实际不保存配置，叫"一键启动"会
   *                与 hero 的「开始部署」看起来是同一件事，而行为不同）
   *   「一键部署」→「运行与连接」（那本是导航项的名字，正文不该另造一个）
   *   「一键修复」→「自动修复」（与"部署"无关，不该共用"一键"这个前缀）
   * 用户可见文案里不得再出现「一键」。注释里可以提（说明历史），故分行断言。 */
  for (const [name, text] of [['index.html', html], ['app.js', app]]) {
    for (const line of text.split('\n')) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;   // 跳过注释行
      assert.doesNotMatch(line, /一键/, `${name} 的用户可见文案仍含已废弃的「一键」：${line.trim()}`);
    }
  }

  // 术语表里的唯一说法必须真的在用
  assert.match(html, /id="topStartButton">启动服务</, '顶栏按钮初始文案应为「启动服务」');
  assert.match(app, /ready \? '重新部署' : '启动服务'/, '顶栏按钮就绪态文案应为「重新部署」');
  assert.match(html, /id="repairHealth">自动修复</, '诊断页按钮应为「自动修复」');

  // 引用"部署页"只能用导航项的名字「运行与连接」，不得另造
  assert.doesNotMatch(html, /一键部署/);
  /* ★ 第 41 轮重锚：原判据在 index.html 里找「前往运行与连接」，
   *   而那句引导文案现在写在 app.js 的运行时提示里
   *   （"请先在上一步创建 Tunnel 并回到“运行与连接”填写"）。
   *   原意图一字未改 —— **引用这一页时必须用侧栏导航项的那个名字**，
   *   另造说法会让用户在侧栏里找不到它 —— 只是落点从标记挪到了脚本。 */
  assert.match(app, /“运行与连接”/,
    '引用部署页时必须用侧栏导航项的名字「运行与连接」—— 另造说法会让用户找不到那一页');
  assert.doesNotMatch(app, /一键部署/);
});

test('the third name above each heading is gone', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  const css = read('renderer/styles.css');

  /* 第 21 轮删掉「眉标」小字（.eyebrow / .section-kicker）。
   * 它的问题是同一个页面有三个名字：
   *   侧栏叫「运行与连接」、眉标叫「连接配置」、标题又叫「运行与连接」。
   * 9 个页面里 8 个有这第三个说法，剩下 1 个（偏好设置）与标题完全重复。
   * 删掉后每个页面只剩「侧栏标签 + 页面标题」两个名字。 */
  assert.doesNotMatch(html, /class="eyebrow"/, 'index.html 不应再有眉标元素');
  assert.doesNotMatch(html, /class="section-kicker"/, 'index.html 不应再有区块标签');
  assert.doesNotMatch(app, /pageEyebrow/, 'app.js 不应再查找已删除的元素');
  assert.doesNotMatch(css, /\.eyebrow|\.section-kicker/, 'styles.css 不应保留无元素的规则');

  /* app.js 的 $() 是裸 querySelector、不做空值检查（第 56 行）：
   * 只要留下 $('#pageEyebrow').textContent = ... 这一行，
   * navigate() 就会在连点导航时抛 TypeError，整个页面切换失效。
   * 所以必须确认 pageMeta 已从三元组收缩为二元组，且解构点同步更新。
   *
   * ★ 第 22 轮修正了一处被本测试"锁错"的 bug：
   *   第 21 轮收缩 pageMeta 时，解构写成了 const [, title, subtitle] ——
   *   那是**三元组**时代的写法（逗号跳过下标 0 的眉标）。
   *   用在二元组上会取到 [说明, undefined]：9 个页面的 H1 全变成说明句、
   *   副标题全空。而当时的断言恰好也写成 [, title, subtitle]，把这个错误
   *   当成了"正确"固定下来 —— 测试与代码犯了同一个错，于是双双通过。
   *   教训：测试必须表达**期望的事实**，不能照抄实现里写的东西。
   *   二元组就是 [title, subtitle]，不带前导逗号。 */
  assert.match(app, /const \[title, subtitle\] = pageMeta\[page\]/,
    'pageMeta 是二元组，解构应为 [title, subtitle]（无前导逗号）');
  // 只匹配"解构语句"本身（const [..., ...] = pageMeta[page]），
  // 否则会误伤 app.js 里那段解释这个 bug 的注释文字。
  assert.doesNotMatch(app, /const \[, title, subtitle\] = pageMeta\[page\]/,
    '[, title, subtitle] 是三元组写法，用在二元组上会让标题/说明错位');
  assert.doesNotMatch(app, /'主页'|'连接配置'|'访问与权限'|'任务中心'|'自动验证', '构建|'系统诊断'|'接入帮助'|'诊断记录', /,
    'pageMeta 里不应残留已废弃的眉标文案');

  /* 每个页面共用的顶栏标题仍须存在（删的是眉标，不是标题）。
   * ★ 界面重写后标题由 pageMeta **运行时注入**，静态 <h1> 只是首屏初值，
   *   所以不再锁 "运行总览" 这个旧字面量 —— 改成断言
   *   "初值 == pageMeta.overview 的标题"，它守的仍是原来的那条：
   *   标题只有一个来源（写死的第二份会立刻对不上）。 */
  const titleText = html.match(/<h1 id="pageTitle"[^>]*>([^<]*)<\/h1>/)?.[1] || '';
  assert.ok(titleText, '顶栏标题落点 #pageTitle 必须存在（删的是眉标，不是标题）');
  const overviewEntry = app.match(/overview: \['([^']+)', '([^']+)'\]/);
  assert.ok(overviewEntry, 'pageMeta 里应有 overview 条目');
  assert.equal(titleText, overviewEntry[1],
    `静态 h1 是首屏初值，必须与 pageMeta.overview 的标题一致（实得「${titleText}」vs「${overviewEntry[1]}」）`
    + ' —— 不一致说明标题被写死了第二份');
  /* ★ 遍历真实的 pageMeta 键，并断言它**与真实页面一一对应** ——
   *   不再硬编码"至少 13 个"：那个数字是"当时有几个页面"的快照，
   *   删掉空壳页面（workspace / logs / advanced）后它立刻变成假红，
   *   而这条判据要守的从来不是数量，是"每个真实页面都有标题与说明、
   *   一个都不能漏"。两个方向都要红：删了页面没删 meta（多出来），
   *   加了页面忘了加 meta（回落到默认标题）。 */
  const metaKeys = [...(app.match(/const pageMeta = \{([\s\S]*?)\n\};/)?.[1] || '')
    .matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
  const htmlPages = [...new Set(
    [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/data-page-view="([\w-]+)"/g)].map((m) => m[1])
  )];
  assert.ok(metaKeys.length > 0, '应能从 pageMeta 读出页面集合');
  assert.deepEqual(metaKeys.slice().sort(), htmlPages.slice().sort(),
    `pageMeta 必须与真实页面一一对应（meta=[${metaKeys.join(', ')}] / `
    + `页面=[${htmlPages.join(', ')}]）`);
  for (const page of metaKeys) {
    assert.match(app, new RegExp(`${page}: \\['[^']+', '[^']+'\\]`),
      `${page} 的 pageMeta 应恰好是两个字段（标题 + 说明）`);
  }
});

test('page titles and subtitles land in the right place at runtime', () => {
  const app = read('renderer/app.js');

  /* 上面那条测试是"读源码做正则匹配"，它能证明写法对，但证明不了**结果**对。
   * 第 21 轮的错位 bug 正是从这个缝里漏过去的：正则匹配 [, title, subtitle]
   * 一路绿灯，而运行起来 9 个页面的 H1 全是说明句。
   *
   * 所以这条测试换成"真跑一遍"：
   *   把 pageMeta 的源码取出来在沙箱里求值，再按 navigate() 里的方式解构，
   *   最后断言 title 不像说明、subtitle 有内容。
   * 这样无论解构写成什么样，只要结果错位就会失败。 */
  const metaBody = app.match(/const pageMeta = \{([\s\S]*?)\n\};/);
  assert.ok(metaBody, '应能在 app.js 里找到 pageMeta 定义');

  // 用 vm 求值出真实的 pageMeta 对象（只取数据，不执行其他代码）
  const vm = require('node:vm');
  const pageMeta = vm.runInNewContext(`({${metaBody[1]}})`);

  /* 第 28 轮：build 页已删除（用户第 1 条「构建与验证有什么用？」→
   * 决策「降成任务页区块」）。
   * ★ 界面重写把页面从 8 个扩到 13 个并重命名了标题，所以这里**不再抄一份
   *   "页面 → 标题"的期望表**（那只是把某一版快照抄进测试，改个文案就得改测试），
   *   改成断言真正的性质：
   *   ① 集合同进同退 —— pageMeta 的键集合 == HTML 里 data-page-view 的集合。
   *      页面少了但 pageMeta 还留着键 → navigate() 走到 $$('.page') 把所有块
   *      取消激活 → 页面变空白却没有任何报错；反之 pageMeta 少了而 HTML 还有
   *      → 那个导航按钮点了没反应。两边必须一起改。
   *   ② 每个条目仍是二元组、标题短、说明是一句话（第 21 轮错位 bug 的判据）。 */
  const html = read('renderer/index.html');
  const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const stripJsComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const appCode = stripJsComments(app);
  const metaPages = Object.keys(pageMeta);
  const htmlPages = [...htmlNoComments.matchAll(/data-page-view="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(metaPages.sort(), htmlPages.slice().sort(),
    `pageMeta 的页面集合必须与 HTML 的 data-page-view 集合完全一致`
    + `（pageMeta：${metaPages.join('/')}；HTML：${htmlPages.join('/')}）`
    + ' —— 任一侧多/少一个页面都会造成"白页"或"点了没反应"');

  /* 这三条都必须在**剥掉注释之后**的文本上断言。
   * 源码里的注释正在解释"原来这里是 if (page === 'build') inspectBuild()"、
   * "它与构建页的 #buildReport 读的是同一份数据" —— 直接匹配原文会把
   * 这些说明文字当成违规命中。（这个坑本轮已经栽过 6 次，见各测试开头的 strip。） */
  assert.doesNotMatch(metaBody[1], /build:/, 'pageMeta 不应残留已删除的 build 页');
  assert.doesNotMatch(htmlNoComments, /data-page-view="build"/, 'HTML 不应残留 build 页区块');
  assert.doesNotMatch(htmlNoComments, /data-page="build"/, '侧栏导航不应残留 build 项');
  assert.doesNotMatch(appCode, /page === 'build'/, 'navigate() 不应再为 build 页派发加载');

  /* ★★ 第 41 轮新增（真缺陷）：删掉 workspace / logs / advanced 之后，
   *   app.js 里那条 IPC 入口还带着旧护栏
   *       api.onNavigate?.((targetPage) => { if (pageMeta[targetPage]) navigate(targetPage); });
   *   —— 而 pageMeta 已经没有这三个键了，于是**主进程传旧名时被静默丢掉**：
   *   托盘菜单「切换工作区」（main.js 的 openSettingsSurface('workspace')）
   *   会打开窗口却停在原来那一页，用户看到的是"点了没反应"。
   *   这与上面那条"页面集合必须一致"是同一类风险的另一半：
   *   集合对了，**入口**却可能还在按旧集合过滤。
   *
   *   判据取"入口必须把旧名交给 navigate 统一收口"，而不是抄一份白名单 ——
   *   白名单会随页面改名过期，navigate 里的重定向才是唯一的事实来源。
   *   同时确认 navigate **确实**还做着这三条重定向（不然放开过滤就等于白页）。 */
  assert.match(appCode, /api\.onNavigate\?\.\(\(targetPage\) => navigate\(targetPage\)\);/,
    '★ 主进程导航入口必须把页面名直接交给 navigate —— '
    + '用 pageMeta 预过滤会把 workspace/logs/advanced 这些旧名静默丢掉');
  for (const [legacy, target] of [['workspace', 'deploy'], ['logs', 'health'], ['advanced', 'settings']]) {
    assert.match(appCode, new RegExp(`page === '${legacy}'`),
      `navigate 必须还认得旧页面名 ${legacy}（重定向到 ${target}）—— 否则放开过滤就等于白页`);
  }

  for (const page of metaPages) {
    const entry = pageMeta[page];
    assert.equal(entry.length, 2, `${page} 的 pageMeta 必须是二元组 [标题, 说明]`);

    // 完全照搬 navigate() 的解构方式
    const [title, subtitle] = entry;

    assert.ok(title && title.length <= 8, `${page} 标题应短（实测 "${title}"），过长说明取到了说明句`);
    assert.ok(!title.includes('。'), `${page} 标题里不应有句号 —— 那是说明句的标点`);
    assert.ok(subtitle && subtitle.length > 6, `${page} 的说明不能为空（实测 "${subtitle}"）`);
    assert.ok(subtitle.includes('。') || subtitle.includes('、'),
      `${page} 的说明应是一句话（实测 "${subtitle}"）`);
    assert.notEqual(title, subtitle, `${page} 的标题与说明不应相同`);
  }
});

test('the developer-mode gate is the single source of truth for the three destructive maintenance actions', () => {
  /* 第 28 轮：用户原话「设置一个"开发者模式"的选项，点击它高级设置与维护里的
   * 相关按钮才会生效，没点击前其他选项都是灰色的，无法点击」。
   *
   * 这条测试守三个**各自独立会坏**的点：
   *   ① 闸门是否真的挂上了那三个按钮（漏挂一个 = 那道闸门形同虚设）
   *   ② 默认值必须是 false（这是**安全默认**，不是体验偏好 ——
   *      见 electron/services/config.js 里 developerMode 的注释）
   *   ③ 开关状态必须能存进去。这一条是实测抓出来的真 BUG：
   *      collectSettings() 原先没提交 developerMode 字段，而主进程 normalize()
   *      是"patch 里有的键才覆盖"，于是开关看着能用、重启就打回关闭。
   *      静态断言必须同时盯住 collectSettings 与主进程白名单两处，
   *      否则只改一处就又会静默失效。 */
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  const css = read('renderer/styles.css');
  const config = read('electron/services/config.js');
  const main = read('electron/main.js');
  /* 断言前剥掉注释 —— 本文件已经三次被自己写的说明性文字搞红
   * （护栏正则看不见注释与代码的区别）。 */
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const htmlCode = stripComments(html);
  const appCode = stripComments(app);

  /* 1) 三个破坏性动作必须都带 data-dev-gated 标记 */
  for (const id of ['removeRuntimeKey', 'regenerateToken', 'clearChatSession']) {
    assert.match(htmlCode, new RegExp(`id="${id}"[^>]*data-dev-gated`),
      `${id} 必须带 data-dev-gated 标记，否则开发者模式这道闸门管不住它`);
  }

  /* 2) 受控元素由统一收集器处理，而不是逐个 id 写死 ——
   *    后者每加一个受控元素都要回来改函数、且容易漏。 */
  assert.match(appCode, /\$\$\('\[data-dev-gated\]'\)/, 'renderDeveloperMode 必须统一收集 [data-dev-gated]');
  assert.match(appCode, /\$\$\('\[data-dev-panel\]'\)/, 'renderDeveloperMode 必须统一收集 [data-dev-panel]');
  assert.match(appCode, /function renderDeveloperMode\(/);

  /* 3) ★ 现界面在这三个按钮上写了静态 `disabled`，作为"默认关闭"的初值。
   *    原意图是"不出现两处真相"—— 静态属性本身不违反这一点，**只要它与
   *    默认值一致、且 JS 每次渲染都覆盖它**。所以判据改成两条可验证的性质：
   *      ① 静态初值必须与默认状态一致（默认 developerMode=false → 初始 disabled；
   *         若默认关闭而按钮却是可点的，那才是真的两处真相）；
   *      ② JS 必须无条件改写 disabled，否则"开启开发者模式后按钮仍然点不动"。 */
  assert.match(config, /developerMode:\s*false/, '默认必须是关闭（下面两条推导的前提）');
  for (const id of ['removeRuntimeKey', 'regenerateToken', 'clearChatSession']) {
    const tag = htmlCode.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`))?.[0] || '';
    assert.ok(tag, `应能找到受控按钮 #${id}`);
    assert.match(tag, /\bdisabled\b/,
      `#${id} 的静态初值必须与默认状态一致（默认关闭 → 初始应 disabled）`);
  }
  assert.match(appCode, /button\.disabled = !on;/,
    'JS 必须每次渲染都覆盖 disabled —— 否则开启开发者模式后按钮仍点不动（静态属性压过动态值）');

  /* 4) 只置灰不给原因，用户会以为坏了 —— 必须补 title 说明。
   *    界面重写换了措辞（现为「需要先解除敏感操作保护」），所以按**语义**断言：
   *    关闭分支里必须给受控按钮写一句说明，且那句话要读得出"被保护锁住了"。
   *    ★ 必须锚在 `if (!on)` 分支内部 —— 只搜关键词会连"打开状态下也挂这句话"
   *      一起放过。 */
  assert.match(appCode,
    /if \(!on\) \{\s*if \(!button\.dataset\.devTitle\)[^;]*;\s*button\.title = '[^']*(?:保护|开发者模式)[^']*';/,
    '关闭状态必须给受控按钮补一句可读的原因提示（只置灰不给原因，用户会以为坏了）');
  assert.match(appCode, /button\.dataset\.devTitle/,
    '打开时必须能还原按钮原本的 title（不能被这句临时提示永久覆盖）');

  /* 5) 性能分析面板归开发者模式（用户决策：「收进开发者模式」）*/
  assert.match(htmlCode, /id="performancePanel"[^>]*data-dev-panel/, '性能分析面板必须带 data-dev-panel');
  /* ★ "默认关闭时它不能可见"现由 JS 保证（renderDeveloperMode 里 panel.hidden = !on），
   *   静态 `hidden` 只是首帧初值。等价判据：默认值 false + JS 每次渲染都覆盖。 */
  assert.match(appCode, /panel\.hidden = !on;/,
    '开发者面板的默认不可见必须由 JS 每次渲染覆盖（默认 false + panel.hidden = !on）');

  /* 6) 默认值必须是 false（安全默认） */
  assert.match(config, /developerMode:\s*false/, 'DEFAULTS 里 developerMode 默认必须是 false');
  assert.match(config, /merged\.developerMode\s*=\s*Boolean\(merged\.developerMode\)/,
    'normalize 必须把 developerMode 强制布尔化，否则字符串 "false" 会被当成真值');

  /* 7) ★ 持久化链路必须两处都通：提交端 + 白名单端。
   *    这是实测抓到的真 BUG（开关看着能用、其实存不进去）。 */
  assert.match(appCode, /developerMode:\s*\$\('#developerModeToggle'\)\?\.checked/,
    'collectSettings 必须提交 developerMode —— 漏掉这行会让开关永远存不进去');
  assert.match(main, /const allowed = \[[^\]]*'developerMode'/,
    'settings:save 白名单必须包含 developerMode，否则主进程会把该字段过滤掉');

  /* 8) 开关本身的绑定必须存在，且要**同时**改 UI 与落盘：
   *    只改 UI 会被重启打回；只落盘则本次会话仍能点到那些按钮。
   *
   *    这里先按**处理器边界**截出 change 处理器的正文，再在正文里找 saveSettings。
   *    先前写成 `renderDeveloperMode(…)[\s\S]{0,200}?await saveSettings` 是错的：
   *    200 字符的窗口会跨到后面 `[data-guide-manual]` 处理器里的 saveSettings 上，
   *    于是删掉本处那行仍然匹配 —— 负向验证（_negtest.js）实测抓出了这个漏洞。
   *    护栏正则必须限定在"这一个函数体"里，不能用宽松的字符数窗口。 */
  assert.match(appCode, /\$\('#developerModeToggle'\)\?\.addEventListener\('change'/);
  const devToggleHandler = appCode.match(
    /\$\('#developerModeToggle'\)\?\.addEventListener\('change'[\s\S]*?\n  \}\);/
  );
  assert.ok(devToggleHandler, '应能截出开发者模式开关的 change 处理器正文');
  assert.match(devToggleHandler[0], /renderDeveloperMode\(event\.target\.checked\)/,
    '开关的 change 处理器必须立刻更新界面');
  assert.match(devToggleHandler[0], /await saveSettings\(false\)/,
    '开关的 change 处理器必须持久化 —— 只有 saveSettings 落在**这个处理器正文内**才算数，'
    + '文件里别处的 saveSettings 不能替代它');

  /* 9) 样式：开关沿用全站既有的 .toggle，不另造一套控件 */
  assert.match(htmlCode, /id="developerModeToggle" class="toggle"/,
    '开发者模式开关应复用 .toggle，保持与其它布尔设置项一致');
  assert.match(css, /\.toggle\{[^}]*appearance: none/, '.toggle 样式应存在');
});

test('the developer-mode hint text switches with the gate, so the control explains itself', () => {
  /* 第 28 轮：闸门关闭时如果只有一句静态说明，
   * 用户点了灰色按钮没反应、也不知道为什么。
   * 所以提示文案必须随状态切换，且两句话各自说清"现在能不能用"。 */
  const app = read('renderer/app.js');
  const html = read('renderer/index.html');

  assert.match(html, /id="developerModeHint"/, '提示文案需要一个可被 JS 更新的容器');
  assert.match(app, /hint\.(?:textContent|innerHTML) = on/,
    'renderDeveloperMode 必须更新提示文案');
  /* ★ 机制一字未改（同一处按 on 二选一），只是两句措辞在界面重写时换掉了。
   *   原意图是"两句话各自说清现在能不能用"，所以按**语义**断言：
   *     开启态 → 说明操作已可执行 + 提醒有影响（要谨慎）；
   *     关闭态 → 说明开启之后能做什么，而不是只丢一句"未开启"。
   *   这里要求两条分支都存在（不能把提示退化成一个恒定字符串）。 */
  assert.match(app, /已解除[^']*可执行[^']*请谨慎操作/,
    '开启态文案应提示"操作可执行"并提醒影响');
  assert.match(app, /开启后方可[^']*(?:删除密钥|凭据)/,
    '关闭态文案应说明开启后能用什么，而不是只说"未开启"');
});

test('the chat toolbar loses the ChatGPT brand button but keeps the home action reachable', () => {
  /* 第 28 轮：用户原话「主界面上面的工作栏不要那个chatGPT的图标和文字」，
   * 并在追问后明确「整个移除」。
   *
   * 移除的理由（不只是"用户不喜欢"）：
   *   ① 它是一块**品牌标识**而非导航控件 —— 这个窗口嵌的就是 ChatGPT，
   *      在它自己的工具栏上再写一遍"ChatGPT"，信息量为零；
   *   ② 它的行为 navigate('home') 与左边的刷新**从头到尾等价**
   *      （见 chatViewController.navigate：'reload' → contents.reload()，
   *        'home' → openUrl(CHAT_HOME)，在对话页上落到同一个结果），
   *      而它俩中间只隔 0 个按钮 —— 这是重复入口。
   *
   * 但**动作本身不能消失**：设置页「清除 ChatGPT 登录数据」→ clearSession()
   * → loadHome() 仍在用它。那是清除 Cookie 后必须重新落到登录页的真实需求。
   * 所以这条测试守两件事：UI 入口已移除 **且** 动作仍活着。
   * （这与第 26 轮工具栏「＋ 授权目录」的处理是同一原则：
   *   删掉重复入口，但保证能力至少还有一条活路径。） */
  const html = read('renderer/browser.html');
  const css = read('renderer/browser.css');
  const js = read('renderer/browser.js');
  const controller = read('electron/chatViewController.js');

  /* 断言前剥注释：下面这段说明本身就引用了 #homeButton / .home-button 这些名字，
   * 不剥会被自己的文档搞红（本项目已经五次栽在这上面）。 */
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  const htmlCode = stripComments(html);
  const cssCode = stripComments(css);
  const jsCode = stripComments(js);

  assert.doesNotMatch(htmlCode, /id="homeButton"/, '顶栏 ChatGPT 品牌按钮应已移除');
  assert.doesNotMatch(htmlCode, /class="logo-mark"/, '品牌方块的标记应一并移除');
  assert.doesNotMatch(jsCode, /\$\('#homeButton'\)/, '不应再留它的点击绑定');
  /* 样式也要删干净 —— 留着会让下一个读代码的人以为它还会回来，
   * 而且它含 2 条 color-no-hex 与 2 条 font-size 基线违规。 */
  assert.doesNotMatch(cssCode, /\.home-button/, '.home-button 样式应一并删除');
  assert.doesNotMatch(cssCode, /\.logo-mark/, '.logo-mark 样式应一并删除');

  /* ★ 动作必须活着 */
  assert.match(controller, /async loadHome\(\)/, 'loadHome 必须保留');
  assert.match(controller, /action === 'home'/, "navigate 的 home 分支必须保留");
  assert.match(controller, /clearSession\(\)[\s\S]{0,400}?await this\.loadHome\(\)/,
    '清除登录数据后必须仍能回到首页 —— 这是保留 home 动作的真实理由');
});

test('the nav buttons are ghost buttons that still announce their own disabled state', () => {
  /* ★ 这条测试在第 32 轮被**重写**，因为用户的诉求变了，不是推翻自己。
   *
   * 第 28 轮用户说「前进、回退和刷新按钮要更明显一些」，当时的实测状态是
   * 38×38 + background:transparent + border:0，而且**禁用态只是把箭头调浅**，
   * 悬停才有底色 —— 三个方框在 1346px 宽的栏里完全看不出边界、
   * 也看不出哪个能点。当时的解法是给它们常驻的边框与白底。
   *
   * 第 32 轮用户的要求变了：整栏统一为幽灵按钮语言（「普通操作使用轻量幽灵
   * 按钮（Ghost Button，仅 Hover 显示背景）」），常驻边框的方按钮与右侧的
   * 胶囊、齿轮不再同族。所以外观契约必须跟着改。
   *
   * ★ 但第 28 轮真正修掉的东西**一个都不能丢**，这条测试守的就是它们：
   *   ① 禁用态必须有独立的文字色（改前那版没有，这才是"看不出能不能点"的根因）；
   *   ② hover / active 必须有可见反馈（鼠标一过就知道那是按钮）；
   *   ③ 三个按钮在同一组里、间距收敛，视觉上读成一个"组"；
   *   ④ 尺寸收到 26px —— 它决定了顶部第一行能压到 40px。
   *   也就是说：被放弃的只是"常驻边框"这个**承载方式**，
   *   "可见的可用性反馈"这条用户价值被完整保留。 */
  const html = read('renderer/browser.html');
  const css = read('renderer/browser.css');

  for (const id of ['backButton', 'forwardButton', 'reloadButton']) {
    assert.match(html, new RegExp(`id="${id}" class="nav-button"`), `${id} 应改用 .nav-button`);
  }
  assert.doesNotMatch(html, /class="icon-button" id="(?:back|forward|reload)Button"/,
    '导航按钮不应退回成 .icon-button（那是设置在 index.html 里的通用按钮）');

  /* 锚行首：理由同 .add-workspace 那条 —— 不锚会读到联合规则里的同名选择器。
   * ★ 同时容忍 `.nav-button {`（带空格）：界面重写把这条规则改成多行格式后，
   *   原来只认 `.nav-button{` 的正则会得到 0 条，报出"应只有一处定义"的假红。 */
  const navRules = [...css.matchAll(/^\.nav-button\s*\{([^}]*)\}/gm)].map((m) => m[1]);
  assert.equal(navRules.length, 1, '.nav-button 应只有一处定义');
  const rule = navRules[0];
  /* ① 承载方式：现形态回到 34px 微实体按键（透明幽灵形态在设计语言里被取代）。
   *    被放弃的只是**外观承载方式**，下面 ②③④ 的用户价值一条都不能丢。 */
  assert.match(rule, /width:\s*34px/, '导航按钮应为 34px（单行 64px 顶栏下的尺寸）');
  assert.match(rule, /height:\s*34px/, '导航按钮应为 34px 高');
  /* ② 可用性反馈必须活着（第 28 轮的真实修复）。判据用"静止色 ≠ hover 色"，
   *    这样换配色方案不会误伤，而"把 hover 反馈删掉"一定会被拦下。 */
  const hover = css.match(/\.nav-button:hover:not\(:disabled\)\s*\{([^}]*)\}/)?.[1] || '';
  assert.ok(hover, '应存在 .nav-button:hover:not(:disabled) 规则');
  const restBg = rule.match(/background:\s*([^;]+)/)?.[1].trim();
  const hoverBg = hover.match(/background:\s*([^;]+)/)?.[1].trim();
  assert.ok(restBg && hoverBg && restBg !== hoverBg,
    `★ Hover 必须有可见的背景反馈（静止 ${restBg} → Hover ${hoverBg}）—— 鼠标一过就要认得出这是按钮`);
  assert.match(hover, /(box-shadow|transform):/, 'Hover 还应带位移/阴影反馈，而不只是换色');
  /* ③ 禁用态必须有独立的文字色 —— 这是第 28 轮的核心修复，
   *    "看不出能不能点"的根因就是禁用态与正常态同色。 */
  const disabled = css.match(/\.nav-button:disabled\s*\{([^}]*)\}/)?.[1] || '';
  const disabledColor = disabled.match(/color:\s*([^;!\s]+)/)?.[1];
  const enabledColor = rule.match(/color:\s*([^;\s]+)/)?.[1];
  assert.ok(disabledColor && enabledColor && disabledColor !== enabledColor,
    `★ 禁用态必须有独立的文字色（实得 禁用 ${disabledColor} vs 启用 ${enabledColor}）`);
  /* ④ 三个按钮必须仍读成一个"组"：同容器 + 收敛的间距。 */
  const actions = html.match(/<div class="nav-actions">[\s\S]*?<\/div>/)?.[0] || '';
  assert.ok(actions, '三个导航按钮应同处 .nav-actions');
  for (const id of ['backButton', 'forwardButton', 'reloadButton']) {
    assert.match(actions, new RegExp(`id="${id}"`), `${id} 必须与另外两个按钮同组同尺寸`);
  }
  const actionsRule = css.match(/^\.nav-actions\s*\{([^}]*)\}/m)?.[1] || '';
  assert.match(actionsRule, /gap:\s*\d/, '.nav-actions 必须有收敛的间距（否则三个按钮读不成一组）');
});

test('the task strip sits on the right as one compact line and never spans the bar', () => {
  /* ★ 这条测试在第 32 轮被**重写**（第 28 轮它守的是"两行 + 空闲不画空进度条"）。
   *
   * 用户第 3 条的原话：「任务状态靠右对齐：无任务时显示紧凑的 `[ ⚪ 空闲 ]` 标签；
   * 运行任务时显示 `[ 🔵 正在构建 (45%) ]` 动态小进度条。
   * **去除中间无意义的超长空灰条**，让整个栏目紧凑、克制、信息明确。」
   *
   * ★ "超长空灰条"是**实测确认的**，不是主观判断。改前的三层成因：
   *   ① .task-strip 是 flex:1 1 auto —— 在 1360px 宽的栏里被撑到约 700px；
   *   ② background:var(--sunken) —— 浅灰底把整条 700px 都涂上，
   *      即使里面只有一个「暂无任务」，视觉上也是一条"条"；
   *   ③ .task-body 是 flex-direction:column 的两行结构，在 26px 高的胶囊里
   *      会把行高挤到 13px。
   * 所以断言必须同时覆盖这三条 —— 只断言"有 flex:0 0 auto"挡不住有人
   * 把浅灰底加回来（那一样会让它看起来像一条灰带）。 */
  const html = read('renderer/browser.html');
  const css = read('renderer/browser.css');

  /* ① 宽度由内容决定（去掉了 flex:1，这是"超长"的直接成因）。
   * ★ "靠右对齐"的承载者换了：不再由胶囊自己 margin-left:auto，
   *   而是父容器 .toolbar-right{margin-left:auto} 把整块右侧区推过去 ——
   *   胶囊只负责"宽度由内容决定"。所以判据拆成两条：胶囊不撑满 + 它在
   *   .toolbar-right 里，且那个容器自己带 margin-left:auto。 */
  const stripRules = [...css.matchAll(/^\.task-strip\{[^}]*\}/gm)].map((m) => m[0]);
  assert.equal(stripRules.length, 1, '.task-strip 的完整外观应只有一处定义');
  const rule = stripRules[0];
  assert.match(rule, /flex:0 0 auto/, '★ 任务胶囊的宽度必须由内容决定 —— flex:1 是"超长灰条"的直接成因');
  assert.doesNotMatch(rule, /flex:1 1 auto/, '不得再让它撑满整行');
  const rightBlock = html.slice(html.indexOf('class="toolbar-right'), html.indexOf('</header>', html.indexOf('class="toolbar-right')));
  assert.match(rightBlock, /id="taskStrip"/,
    '★ 任务状态必须落在 .toolbar-right 里 —— 靠右由该容器承担（第 32 轮的单行顶栏）');
  assert.match(css, /^\.toolbar-right\s*\{[^}]*margin-left:auto/m,
    '★ .toolbar-right 必须 margin-left:auto 靠右停（否则任务状态会浮在左半边）');
  /* ② 没有铺满整条的底色（"灰条"的观感来源）。
   *   静止态允许有极浅的底色轮廓（新设计的胶囊外观），但**空闲态必须收起**：
   *   `[ ⚪ 空闲 ]` 是"无任务"的正常状态，铺一条灰底就又会读成"任务区坏了"。 */
  const idleRule = css.match(/^\.task-strip\.idle\{([^}]*)\}/m)?.[1] || '';
  assert.ok(idleRule, '应存在 .task-strip.idle 规则');
  assert.match(idleRule, /background:transparent/,
    '★ 空闲态不得铺底色 —— 那是"灰条"观感的来源');
  assert.match(idleRule, /border-color:transparent/,
    '★ 空闲态连边框也要收起，只留一个圆点 + 一个词');
  assert.doesNotMatch(css, /\.task-strip[^{]*\{[^}]*background:var\(--sunken\)/,
    '★ --sunken 曾是把整条 700px 涂成浅灰的那个值，不得回来');
  /* ③ 单行：容器不再是纵向两行。 */
  assert.doesNotMatch(rule, /flex-direction:column/, '任务胶囊应是一行，不再拆两行（26px 高装不下两行）');
  assert.doesNotMatch(html, /class="task-body"/, '已删掉两行的 .task-body 结构');
  assert.doesNotMatch(html, /class="task-line"/, '已删掉 .task-line 结构');

  /* ④ 空闲态：文案是「空闲」而不是「暂无任务」；进度条与百分比收起。 */
  assert.match(js_(), /task\?\.objective \|\| \(runningOperation \? '后台任务运行中' : '空闲'\)/,
    '★ 空闲态应写作「空闲」—— "暂无任务"的缺省语气与"没有任务本来正常"不符');
  assert.match(css, /\.task-strip\.idle \.task-progress[^{]*\{display:none\}/,
    '空闲态应收起进度条（0% 的空槽看着像坏了）');
  assert.match(js_(), /strip\.className = `task-strip \$\{status\}`/,
    'browser.js 必须继续按状态写类名 —— .idle 由它产生，不需要额外改 JS');

  /* ⑤ 运行态必须出现"动态小进度条"（用户第 3 条逐字要求）。 */
  assert.match(css, /\.task-strip\.active\{--strip-accent:/,
    '★ 运行态的状态色必须由 --strip-accent 统一驱动 —— 状态点与进度条要同时跟随');
  assert.match(css, /\.task-progress span\{[^}]*background:var\(--strip-accent\)/,
    '进度条的填充色应引用 --strip-accent（改前它在 5 个状态选择器里被各写一遍，'
    + '形状是 `.task-strip.paused .task-progress span` 这种 (0,3,1)，属棘轮里的高特异性违规）');
  /* 百分比按用户给的形态加括号：`[ 🔵 正在构建 (45%) ]` */
  assert.match(js_(), /function progressLabelForTask\(task, status, runningOperation, command, progress\)/,
    '进度标签需要 progress 入参才能拼出 (45%) 这一形态');
  assert.match(js_(), /return `\(\$\{progress\}%\)`;/, '运行态标签应为 `(45%)` 形态');
});

test('the workspace switcher merges the label, the picker and the add action into one menu', () => {
  /* ★ 这条测试在第 32 轮被**重写**（第 28 轮它守的是"选择器与添加按钮可区分"）。
   *
   * 用户第 3 条的原话：「彻底合并"切换工作区"文本和右侧的"下拉框/添加按钮"。
   * 统一做成一个工作区面包屑下拉菜单：`[ 📁 测试文件夹 ▾ ]`，
   * 点击即可弹出最近工作区列表、快速切换以及"+ 添加工作区"操作。」
   *
   * ★ 改前这一行有**四个**工作区相关件，全部平铺：
   *   ① .workspace-bar-title「切换工作区」纯文本标签
   *   ② .workspace-label「当前 xxx」+ 健康点
   *   ③ .workspace-picker + 200px 的裸 select（margin-left:auto 推到右边）
   *   ④ .add-workspace「＋ 添加工作区」深色实心按钮
   * 用户的判断是对的：这是同一件事的四个碎片。
   *
   * ★ 合并**不等于**删能力 —— 这条测试守的就是"每一项能力都还在"，
   *   同时守住"碎片真的被收进了一个容器"。两半缺一不可：
   *   只断言菜单存在，挡不住有人把四个碎片又摊回栏里；
   *   只断言碎片消失，挡不住能力被静默删掉。 */
  const html = read('renderer/browser.html');
  const css = read('renderer/browser.css');
  const js = js_();

  /* ① 一个触发器 + 一个菜单容器，菜单里装三样东西。
   *    ★ 菜单现在是有嵌套的块，用 `[\s\S]*?<\/div>` 会停在第一个内层 </div>
   *      上（那样只能看到"当前项目"一节），所以改成配对扫描取整块。 */
  const divPairFrom = (text, from) => {
    const re = /<div\b[^>]*>|<\/div>/g;
    re.lastIndex = from;
    let depth = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      depth += m[0].startsWith('</') ? -1 : 1;
      if (depth === 0) return m.index;
    }
    return -1;
  };
  const menuStart = html.indexOf('<div class="workspace-menu"');
  assert.ok(menuStart >= 0, '应有一个 .workspace-menu 容器（合并后唯一的弹出菜单）');
  const menu = html.slice(menuStart, divPairFrom(html, menuStart));
  assert.match(menu, /id="workspaceMenuPath"/, '★ 菜单里应有完整路径 —— 中间省略会藏掉中段，需要第二条查看途径');
  assert.match(menu, /id="workspaceMenuList"/, '★ 菜单里应有工作区列表容器（最近工作区在这里列出）');
  assert.match(menu, /id="manageWorkspacesButton"/, '★ 菜单里应有「管理工作区…」入口（含添加工作区的能力）');
  assert.match(html, /<button id="workspaceTrigger"[^>]*aria-controls="workspaceMenu"/,
    '切换器必须声明它控制哪个菜单');
  /* 合并的是**入口**不是能力：列表条目必须可点即切，而不是只读文本。 */
  assert.match(js, /item\.onclick = \(e\) => \{[\s\S]{0,200}?switchWorkspace\(ws, true\);/,
    '★ 菜单里的工作区条目必须点击即切换 —— 合并入口不等于砍掉能力');
  assert.match(js, /function toggleWorkspaceMenu\(/, '切换器必须能开合菜单');
  assert.match(js, /trigger\.setAttribute\('aria-expanded'/, '展开态必须由 aria-expanded 承载（CSS/读屏都靠它）');

  /* ② 四个碎片必须**真的**不在栏里平铺了。
   *    ★ 判据用"工具栏的**可见区域**里不再出现这些类名"，而不是"文件里搜不到"
   *      —— 后者会误伤注释与隐藏兼容桩（本项目已在"注释引用了被删写法"上
   *      栽过 14 次；隐藏兼容桩同理：它们不是可见界面的一部分）。 */
  const toolbarStart = html.indexOf('<header class="browser-toolbar">');
  const toolbar = html.slice(toolbarStart, html.indexOf('</header>', toolbarStart))
    .replace(/<div class="compat-hidden-stash"[\s\S]*?<\/div>/, '');
  for (const cls of ['workspace-bar-title', 'workspace-label', 'workspace-picker']) {
    assert.doesNotMatch(toolbar, new RegExp(`class="[^"]*\\b${cls}\\b`),
      `「${cls}」不应再作为可见元素平铺在工具栏里（应已并入切换器/菜单）`);
  }

  /* ③ 面包屑的两个视觉要件：文件夹图标 + 展开箭头（用户给的 `[ 📁 名称 ▾ ]` 形态）。
   *    ★ 文件夹现在是**内联 SVG**（.workspace-trigger-icon），不再是 CSS ::before；
   *      "盖舌"仍由 CSS 画出，但落点移到了菜单里那一枚文件夹图标上。
   *      原意图没变：图标必须是"文件夹"（面包屑语义），且不加载任何外部资源。 */
  assert.match(html, /class="workspace-trigger-icon"[\s\S]{0,240}?<path d="M22 19a2 2 0 0 1-2 2H4/,
    '切换器应有文件夹图标（面包屑语义），画的是文件夹而不是别的形状');
  assert.match(html, /class="workspace-trigger-caret"/, '切换器应有展开箭头');
  assert.match(css, /\.workspace-menu-folder-icon::before\{/,
    '文件夹的"盖舌"应由 CSS 画出（本文件不加载任何外部资源，13px 下 SVG 与 CSS 无差别）');

  /* ④ ★ 工作区名必须**整段可读**，且完整路径必须另有查看途径。
   *   重写前的契约是"工作区名必须走中间省略（CSS 只能末尾省略）"；
   *   现界面换了做法：切换器只显示**末段目录名**（baseName，整段完整），
   *   完整路径放在菜单的 #workspaceMenuPath 与切换器的 title 上。
   *   原意图（"末段目录名不能被切成残词，用户必须能找回完整路径"）
   *   一条都没丢 —— 只是从"省略算法"换成了"分层显示"。 */
  assert.match(js, /const projectName = activeWorkspace \? baseName\(activeWorkspace\)/,
    '★ 切换器显示的是末段目录名（baseName）—— 整段完整，不按字符截断');
  assert.doesNotMatch(js, /label\.textContent = [^\n]*middleEllipsis/,
    '★ 末段目录名不得再走按字符切分的省略 —— 那会切出半个目录名（残词比省略更难读）');
  assert.match(js, /label\.title = activeWorkspace \? [^\n]*\$\{activeWorkspace\}/,
    '★ 悬浮必须能看到完整路径（用户第 3 条逐字要求）');
  assert.match(js, /menuPath\.textContent = activeWorkspace/,
    '★ 菜单里必须有完整路径的落点 —— 省略/截断之外的"第二条查看途径"');

  /* ④b middleEllipsis 现已**没有调用点**（死代码，已列入需要代码侧处理的清单：
   *     要么接线、要么删除）。在它消失或重新接线之前，仍要求保留
   *     "budget 非法时不膨胀"的兜底 —— 半成品比没有更危险：
   *     后来的人接上它就会踩到 NaN 那条路（`…<完整原文>`）。 */
  if (/function middleEllipsis\(/.test(js)) {
    assert.match(js, /const limit = Number\.isFinite\(budget\) \? budget : Number\.POSITIVE_INFINITY;/,
      'budget 缺失/非法时必须退化成"不省略"，不能让 NaN 流进 slice');
  }

  /* ⑤ 主操作唯一：改前「设置」与「添加工作区」都是深色实心，两块同屏互相抢。
   *    现界面把「添加工作区」整体收进菜单（可见落点是「管理工作区…」），
   *    工具栏可见区域里不再有第二块实心主操作。 */
  const stashStart = html.indexOf('class="compat-hidden-stash"');
  assert.ok(stashStart >= 0, '应保留一个隐藏的兼容桩容器（旧 id 的事件绑定点）');
  const stash = html.slice(stashStart, divPairFrom(html, stashStart));
  assert.match(stash, /id="addWorkspace"/,
    '「添加工作区」按钮应降级为不可见的兼容桩 —— 可见入口改由菜单的「管理工作区…」承载');
  assert.match(html, /class="compat-hidden-stash"[^>]*\bhidden\b/, '兼容桩容器必须 hidden（不占布局、不可见）');
  assert.doesNotMatch(toolbar, /id="addWorkspace"/,
    '★ 工具栏可见区域不得再出现「添加工作区」实心块（整栏只能有一个主操作）');
  /* 设置按钮必须已经不是深色实心/主操作色（否则"唯一主操作"不成立）。 */
  const managerRule = css.match(/^\.manager-button\s*\{([^}]*)\}/m)?.[1] || '';
  assert.ok(managerRule, '应能定位 .manager-button 规则');
  assert.doesNotMatch(managerRule, /background:\s*(?:#202123|var\(--accent-soft-text\)|var\(--btn-primary-bg\))/,
    '★ 设置按钮改齿轮后不得再是深色实心/主操作色 —— 整栏只能有一个主操作');
});

test('the workspace switcher announces why it is unavailable before the user picks', () => {
  /* 第 29 轮（用户第 10 条「显示也不会跟着切换后的工作区」）。
   *
   * ★ 这条护栏来自真机实测，不是推演。_probe-r29-ws.js 在运行中的应用里
   *   派发 change 事件后拿到的结论出乎意料：
   *     #activeWorkspace 文本  D:\...\世界观设定 → C:\...\wb-round28-VM7Lf0  ✅ 变了
   *     #workspaceSelect.value ""                   → ""                     ⚠️
   *   也就是说"标签不跟着切换"这个字面理解是错的 —— 标签**确实**在跟着变。
   *   真正的问题有两层，都被这次实测挖出来了：
   *
   *   ① 下拉是"动作选择器"却长得像"当前值选择器"：
   *      placeholder 写着「全部工作区（3）」（筛选语义），选项里还有一项
   *      「当前：xxx」；选完 value 立刻被重置回空 ——
   *      于是"当前是哪个"这句话**只在没选中时可见**，选中时反而消失。
   *
   *   ② ★ 最关键的：heartbeat payload 里**早就有 busy 字段**
   *      （orchestrator.snapshot 第 460 行），表示"助手正在启动/部署，
   *      不接受工作区切换"，但前端**从来没用过它**。
   *      实测时正是如此：点开下拉选一个工作区 → 红色错误
   *      「当前已有任务正在运行。」—— 一次白白的误操作。
   *      注意改前那条错误还是**绿色**的（.switch-state 只有一个颜色），
   *      看起来像成功提示。这是"显示不会跟着切换"的另一半成因：
   *      不是没更新，而是根本没切成功、且事先毫无提示。
   *
   * 三条改动因此必须同时被守住，缺一条用户就会退回原来的困惑。
   *
   * ★ 第 32 轮：第 ① 条的载体换了（.workspace-label 并进切换器、
   *   .workspace-bar-title 被删），但**语义契约本身没变**，所以这条测试
   *   整体保留、只改动载体相关的两处断言。第 ②③ 条一字未动。 */
  const js = read('renderer/browser.js');
  const html = read('renderer/browser.html');
  const css = read('renderer/browser.css');

  /* ① 动作语义的两个载体：placeholder 文案 + 不再列"当前：xxx"。 */
  assert.match(js, /placeholder\.textContent = '选择要切换的工作区…'/,
    'placeholder 应表达动作语义（"选择要切换的工作区…"），不得沿用筛选语义的"全部工作区"');
  assert.doesNotMatch(js, /当前：\$\{baseName/,
    '当前工作区不应再作为一个可选项出现 —— 它的显示由切换器按钮常驻承载');
  /* ★ 第 32 轮改：改前断言 `<span class="workspace-bar-title">切换工作区</span>` 存在。
   *   那个纯文本标签已被合并进切换器按钮（用户第 3 条「彻底合并"切换工作区"文本」），
   *   所以载体从"一个可见的 <span>"变成"按钮的 title + aria" —— 名字必须还在，
   *   否则合并就变成了一次静默的能力删除（用户会不知道这块东西是干什么的）。 */
  assert.doesNotMatch(html, /class="workspace-bar-title"/,
    '「切换工作区」纯文本标签应已被合并（它是第 32 轮的主要合并对象之一）');
  assert.match(html, /class="workspace-trigger"[^>]*title="切换工作区"/,
    '★ 「切换工作区」这个名字必须仍然可见（现在挂在切换器按钮的 title 上）');

  /* ② busy 必须提前可见。断言完整语句而不是关键词 ——
   *    只 match(/busy/) 的话，函数体里任何一处提到 busy 都能通过。 */
  assert.match(js, /const busy = Boolean\(lastRuntimeState\?\.busy\);/,
    'syncWorkspacePickerState 必须真的读 heartbeat 里的 busy —— 这正是改前被完全忽略的字段');
  assert.match(js, /select\.disabled = !hasTargets \|\| busy;/,
    '禁用态是"没有可切目标 或 正在启动/部署"的**与**关系；只写 busy 会把前者覆盖掉');
  assert.match(js, /renderWorkspaceHealth\(\);\s*syncWorkspacePickerState\(\);/,
    'heartbeat 到达时必须重算禁用态（busy 结束后要能自动恢复可用）');
  assert.match(js, /助手正在启动或部署，期间不能切换工作区/,
    '置灰必须同时给出原因（title），否则用户看到灰控件只会以为坏了');

  /* ③ 切换失败必须以 error 相反馈。
   * ★ 这里第一版写的是 `assert.match(js, /setSwitchFeedback\(error\.message, 'error'\)/)`
   *   —— 负向验证当场把它打脸：把那处 'error' 去掉后测试仍然全绿，
   *   因为文件里还有另外 4 处同名调用（暂停/继续/停止/添加工作区），
   *   任一命中即通过。这正是本项目铁律 #2「只搜关键词 = 假护栏」的复发。
   *   修法：断言的锚点必须**唯一** —— 带上只有 switchWorkspace 才有的上下文。 */
  assert.match(js, /catch \(error\) \{\s*setSwitchFeedback\(error\.message, 'error'\);\s*\} finally \{\s*switching = false;\s*document\.querySelector\('\.workspace-bar'\)\?\.classList\.remove\('switching'\);\s*\}\s*\}\s*async function navigate/,
    '切换失败必须以 error 相反馈，且锚点必须是 switchWorkspace 里那唯一一处');
  assert.doesNotMatch(js, /\$\('#switchState'\)\.textContent = /,
    '不应再由 JS 直接写 #switchState.textContent —— 必须走 setSwitchFeedback（颜色与 hidden 同步管理）');
  /* ③ 切换失败必须以"红色语义"反馈。
   *   原判据是 `.switch-state[data-phase="error"]{color:var(--red)}`。
   *   现界面把失败态写成了具体色值（background/border + color:#b91c1c），
   *   但**语义契约没变**：失败必须落在红色系，绝不能像成功提示那样是绿的。
   *   所以改成按语义判"是红色"，而不是钉住某个令牌名（换配色方案不该误伤，
   *   而"把 error 态改回绿色"一定会被拦下）。 */
  const errorRule = css.match(/\.switch-state\[data-phase="error"\]\{([^}]*)\}/)?.[1] || '';
  assert.ok(errorRule, '失败态必须有独立的 [data-phase="error"] 规则');
  const errorColor = errorRule.match(/color:\s*([^;}]+)/)?.[1].trim() || '';
  const isRedFamily = (value) => {
    if (/var\(--red\b/.test(value)) return true;
    const hex = value.match(/^#([0-9a-f]{6})$/i);
    if (!hex) return false;
    const n = parseInt(hex[1], 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return r > g && r > b;   // 红色分量占优即算红色系
  };
  assert.ok(isRedFamily(errorColor),
    `失败态应是红色系 —— 改前只有一个绿色，错误信息看起来像成功提示（实得 color:${errorColor}）`);
  assert.match(css, /\.workspace-bar\.switching::after\{[^}]*animation:/,
    '切换期间需要可见的动态反馈（实测切换约 1.5 秒，期间整条栏原本完全静止）');
  /* 这条动态反馈必须不撑高 —— 高度是跨进程契约（--toolbar-height），
   * ChatGPT 视图的 setBounds 依赖它。用绝对定位的 ::after 才不会进布局。 */
  const sweep = css.match(/\.workspace-bar\.switching::after\{[^}]*\}/)?.[0] || '';
  assert.match(sweep, /position:absolute/, '扫光必须绝对定位，不得参与布局（否则会撑高工具栏、错位 ChatGPT 视图）');
});

test('the guide masks the tunnel id and never trusts a self-declared confirmation', () => {
  /* 第 29 轮（用户第 4 条）：「在 chatGPT 创建自定义连接器里的隧道（Tunnel ID）
   * 怎么是暴露的？不要搞什么"我已在 ChatGPT 中完成创建"」。两句话，两个契约。
   *
   * ★ 这两条护栏是负向验证（_negtest-round29.js）逼出来的。
   *   第一版我改了源码却没写断言，负向验证报 SURVIVED ——
   *   "改对了但没人守"，下次重构会原样退回，且不会有任何提示。
   *
   * ① 脱敏：实测改前 #guideTunnelId 的 textContent 是明文
   *    `tunnel_6a908223705c819197a8d5a3cc064ffe`，而同一页的演示浏览器
   *    （.mock-browser）里却写着 `tunnel_••••••••••••` —— 脱敏只做了一半。
   *    现在真值只落 dataset.rawValue，可见文本一律走 maskTunnelId。
   * ② 自述式确认：两个 <label class="guide-manual-confirm"> 复选框已被
   *    真实探测按钮替换。勾一下变绿与"链路真的通了"无关，
   *    这正是第 25 轮批评过又长回来的东西 —— 护栏要挡住它第三次长出来。 */
  const html = read('renderer/index.html');
  const js = read('renderer/app.js');
  const css = read('renderer/styles.css');

  /* ① 真值不得进可见文本 */
  assert.match(js, /const raw = String\(el\.dataset\.rawValue \|\| ''\)\.trim\(\);/,
    'Tunnel ID 的真值必须从 dataset 读，不能从可见文本读');
  assert.match(js, /el\.textContent = shown \? \(raw \|\| '尚未填写'\) : maskTunnelId\(raw\);/,
    '可见文本必须是"按状态二选一"的表达式：默认脱敏，点「显示」才给真值');
  /* ★ 反向断言：不得再有"把 settings.tunnelId 直接写进 textContent"的写法。
   *   注意先剥注释 —— 我在改动处写的说明注释里逐字引用了那句旧写法
   *   （"这里原来是 `textContent = settings.tunnelId`"），
   *   不剥注释这条断言会被自己的文档搞红。本项目已栽 8 次。 */
  const jsCode = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.doesNotMatch(jsCode, /\$\('#guideTunnelId'\)\.textContent = settings\.tunnelId/,
    '不得再把 Tunnel ID 明文写进 textContent');
  /* 复制必须复制**真值**：屏幕上显示的是圆点，照抄 textContent 会复制出一串 •。
   * 这是脱敏改造最容易漏的一处 —— 复制本来就是"要把真值拿去用"的动作。 */
  assert.match(js, /const raw = String\(\$\('#guideTunnelId'\)\?\.dataset\.rawValue \|\| ''\)\.trim\(\);[\s\S]{0,300}?copyText\(raw\);/,
    '「复制 Tunnel ID」必须复制 dataset.rawValue（真值），不能复制屏幕上的脱敏文本'
    + '（原判据逐字写死 `$(\'#guideTunnelId\').dataset...`，现实现容许元素缺失用了 `?.` —— 语义未变）');

  /* ② 自述式复选框不得复活 */
  assert.doesNotMatch(html, /class="guide-manual-confirm"/,
    'index.html 不应再有任何自述式确认复选框');
  assert.doesNotMatch(html, /data-guide-manual/,
    'index.html 不应再有任何自述式确认复选框');
  /* ★ 绑定也必须一起删：留着 $$('[data-guide-manual]').forEach(...) 是一段
   *   永远不执行的死代码 —— 它不报错、只是静默失效，六个月后有人照它继续写，
   *   就会重新长出同一套自述确认。 */
  assert.doesNotMatch(jsCode, /\$\$\('\[data-guide-manual\]'\)\.forEach\(\(input\) => input\.addEventListener/,
    'app.js 不得再为已删除的自述复选框保留事件绑定（死代码会诱导它复活）');
  /* 替代品必须是**真实探测**：点击 → 刷新快照与工作区上下文 → 按实测结果判定 */
  assert.match(js, /async function verifyGuideStep\(stepKey, button\) \{[\s\S]*?await refreshSnapshot\(\);[\s\S]*?await loadWorkspaceContext\(\);[\s\S]*?const detected = guideDetected\(\);/,
    '两个"我已完成"按钮必须触发真实探测，而不是点一下就变绿');
  assert.match(js, /\$\('#verifyConnector'\)\?\.addEventListener\('click', \(event\) => verifyGuideStep\('connector', event\.currentTarget\)\);/,
    '第 4 步的验证按钮必须绑到 verifyGuideStep');
  assert.match(js, /\$\('#verifyToolCall'\)\?\.addEventListener\('click', \(event\) => verifyGuideStep\('test', event\.currentTarget\)\);/,
    '第 5 步的验证按钮必须绑到 verifyGuideStep');

  /* ③ 死样式不得残留（删元素必须同时删样式，本项目的既有纪律）。
   * ★ 先剥注释 —— 我在删除处写的说明注释里逐字引用了旧类名
   *   （"删掉 .guide-manual-confirm 和 .step-heading input 两条规则"），
   *   不剥就是第 9 次栽在同一个坑上（前 8 次见项目记忆）。
   *   注释里引用的"已删掉的写法"和真代码在这个正则下没有区别。 */
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(cssCode, /\.guide-manual-confirm/,
    'styles.css 不应保留无元素的 .guide-manual-confirm 规则');
  assert.doesNotMatch(cssCode, /\.step-heading input/,
    'styles.css 不应保留无元素的 .step-heading input 规则');
  /* 脱敏值需要自己的样式才看得出来是"被遮过的"而不是真值。
   * ★ 断言用**带声明内容的完整规则**而不是裸类名 ——
   *   我那段说明注释里逐字写着 `.secret-value`，裸类名会被自己的文档命中。
   *   带上 `color:var(--muted)` 就只可能命中真规则。 */
  assert.match(css, /\.secret-value\{\s*color:\s*var\(--muted\)/,
    '脱敏值应有区别于真值的视觉（.secret-value）');
  /* Tunnel ID 那一行现在要装 4 个元素（名称组 / 值 / 显示 / 复制）。
   * 原意图「3 列会让「隐藏」按钮换行掉到下一格，界面直接错位」一字未改，
   * 只是承载方式从 grid 的 4 列模板换成了 flex 行，所以判据换成等价的四条：
   *   ① 行是 flex 单行且不换行；
   *   ② 名称列定宽（宽度不随文案抖动）；
   *   ③ 值列可伸缩且 min-width:0（长 ID 不会把右侧按钮挤出容器）；
   *   ④ 操作区 flex-shrink:0（「显示/复制」不换行的保证）。 */
  const rowRule = css.match(/^\.connector-field-row\{([^}]*)\}/m)?.[1] || '';
  assert.ok(rowRule, '.connector-field-row 应有样式定义');
  assert.match(rowRule, /display:\s*flex/, 'Tunnel ID 行应是 flex 单行');
  assert.doesNotMatch(rowRule, /flex-wrap:\s*wrap/, '不得换行 —— 4 个元素换行会让这一格错位');
  const labelRule = css.match(/^\.connector-field-label\{([^}]*)\}/m)?.[1] || '';
  assert.match(labelRule, /width:\s*75px/, '名称列应定宽（否则宽度会随文案抖动）');
  const valueRule = css.match(/^\.connector-field-val\{([^}]*)\}/m)?.[1] || '';
  assert.match(valueRule, /flex:\s*1/, '值列应可伸缩');
  assert.match(valueRule, /min-width:\s*0/, '值列必须 min-width:0 —— 否则长 ID 会把右侧按钮挤出容器');
  const actionsRule = css.match(/^\.connector-field-actions\{([^}]*)\}/m)?.[1] || '';
  assert.match(actionsRule, /flex-shrink:\s*0/, '操作区不可收缩 —— 这是「显示/复制」不换行的保证');
  /* 四个元素必须真的在**同一行**里（不能把显示按钮挪到别的容器里就算完）。 */
  const tunnelIdIdx = html.indexOf('id="guideTunnelId"');
  const tunnelStart = html.lastIndexOf('<div class="connector-field-row">', tunnelIdIdx);
  const nextRow = html.indexOf('<div class="connector-field-row">', tunnelStart + 1);
  const tunnelRow = html.slice(tunnelStart, nextRow < 0 ? html.indexOf('</div>', tunnelIdIdx) : nextRow);
  for (const marker of ['connector-field-label-group', 'id="guideTunnelId"', 'id="toggleTunnelId"', 'id="copyTunnelId"']) {
    assert.ok(tunnelRow.includes(marker),
      `Tunnel ID 行必须同时容纳 4 个元素：缺少 ${marker}`);
  }
});

test('the health page groups by troubleshooting order, spreads passes out, and speaks plain Chinese', () => {
  /* 第 29 轮（用户第 7 条）原话拆开是三句，加上一句"整个界面都要优化"：
   *   「"已通过的检查"不要折叠」            → 不折叠
   *   「还有不要这么设置…不要浪费大量空间」  → 但也不能铺成 10 个 58px 大行
   *   「里面的便携 python 是什么？」          → 术语去黑话
   *   「两个 Tunnel 相关的还没有放在一起」    → 分组
   *   「底下的安全边界一股 AI 味」            → 免责长句重做
   *
   * ★ 同样是负向验证逼出来的：改完源码后 _negtest-round29.js 报了 4 条 SURVIVED
   *   （便携 Python 术语、Tunnel ID 明文、tunnel-client 归组、折叠结构），
   *   全部是"改对了但没人守"。这类改动最容易被下一次重构悄悄退回 ——
   *   因为它看起来只是个文案/分组偏好，没有明显的行为后果。
   */
  const html = read('renderer/index.html');
  const js = read('renderer/app.js');
  const css = read('renderer/styles.css');
  const service = read('electron/services/healthService.js');

  /* ① 不折叠，但也不铺成大行。
   *    必须**同时**断言两件事 —— 只断言"没有 details"会放过
   *    "reuse .health-item 平铺"这种省空间的反向错误（10 项 × 58px = 580px，
   *    那正是用户说的"浪费大量空间"）。 */
  const htmlCode = html.replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(htmlCode, /health-fold|healthPassedFold/,
    'index.html 不应再有"已通过的检查"折叠块');
  assert.match(htmlCode, /<section class="health-passed" id="healthPassedBlock">/,
    '通过项应直接铺开（health-passed 区），不再折叠');
  assert.match(css, /\.health-line\s*\{[^}]*min-height:\s*32px/,
    '通过项必须走 32px 紧凑行 —— 省空间靠"行变紧"，不靠"折叠"');
  /* ★ 剥注释后再断言 —— 删除处那段说明逐字写着 ".health-fold（<details> 折叠）"。
   *   本条测试是本项目第 9 次遇到这个坑的现场（同一测试里两处）。 */
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /\.health-fold/,
    'styles.css 不应保留无元素的 .health-fold 规则');
  /* 紧凑行不该再给右侧"正常"字样：一整列每行都写同样的词，扫过去信息量为零 */
  const compactFn = js.match(/function healthRowCompact\(check\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.ok(compactFn, 'app.js 应有 healthRowCompact');
  assert.doesNotMatch(compactFn, /'正常'|'待处理'/,
    '紧凑行不应再有右侧状态词 —— 状态由左侧 ✓ 表达，右侧位置留给真需要说明的失败行');

  /* ② 分组：顺序来自后端 report.groups，前端不得自己硬编码一份。
   *    两个 Tunnel 项必须同组 —— 这是用户明确点出的"没有放在一起"。 */
  assert.match(service, /const CHECK_GROUPS = \[/,
    '分组定义应在 healthService 里（它是领域知识：用户排查问题时该先看哪儿）');
  assert.match(service, /groups: CHECK_GROUPS,/,
    'inspect() 必须把分组随报告一起返回');
  const tunnelChecks = [...service.matchAll(/\{ id: '(tunnel-client|tunnel-id|tunnel-port|tunnel)', group: '(\w+)'/g)];
  assert.equal(tunnelChecks.length, 4, '应有 4 个 tunnel 相关检查项');
  const tunnelGroups = new Set(tunnelChecks.map((m) => m[2]));
  assert.deepEqual([...tunnelGroups], ['tunnel'],
    `4 个 Tunnel 相关检查项必须同组（改前 tunnel-client 与 tunnel 之间隔着 3 个 MCP 项），实际分组：${[...tunnelGroups]}`);
  /* 前端读后端给的分组，且必须处理"后端加了 check 但忘了写 group"的情况 ——
   * 静默丢失会让"10 项检查"在界面上变成 8 项，且用户无从察觉。 */
  assert.match(js, /const GROUP_DEFS = Array\.isArray\(report\.groups\) && report\.groups\.length/,
    'renderHealth 应读后端返回的 groups');
  assert.match(js, /const orphans = checks\.filter\(\(item\) => !claimed\.has\(item\.id\)\);/,
    '未被任何分组认领的检查必须有兜底渲染，不得静默丢失');

  /* ③ 术语去黑话。"便携 Python"是 portable 的直译，用户明确问"这是什么"。
   * ★ 这里必须先剥注释。我在改动处写的说明注释里逐字引用了旧术语
   *   （「便携 Python」这个名字用户看不懂…），而注释里引用"已废弃的说法"
   *   与真代码在正则下没有区别 —— 本项目已栽 9 次的同一个坑。 */
  const serviceCode = service.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\/\/|\*).*$/gm, '');
  assert.doesNotMatch(serviceCode, /便携 Python/,
    'healthService.js 不应再出现"便携 Python"（用户原话：里面的便携 python 是什么？）');
  assert.match(serviceCode, /label: 'Python 运行环境'/,
    '应改成人话标签「Python 运行环境」');
  assert.match(serviceCode, /助手自带，无需你安装/,
    'detail 应解释"便携"是什么意思，而不是让用户去猜');

  /* ④ Tunnel ID 在体检报告里也必须脱敏。
   *    这份报告可能被截图/复制出去发给别人排查 —— 与接入指南同等敏感。 */
  assert.match(service, /function maskSecretId\(value\) \{/,
    'healthService 应有自己的脱敏函数（主进程侧，不依赖 renderer）');
  assert.match(service, /detail: current\.tunnelId \? `\$\{maskSecretId\(current\.tunnelId\)\}（已填写）`/,
    '体检报告里的 Tunnel ID 必须是脱敏值');
  /* ★ 锚点唯一性自检：`detail: current.tunnelId` 这种前缀可能被别处命中，
   *   所以上一行断言带上了 maskSecretId —— 它全文件只出现 1 次。 */
  assert.equal((service.match(/maskSecretId\(current\.tunnelId\)/g) || []).length, 1,
    'maskSecretId(current.tunnelId) 应恰好出现一次（唯一锚点）');

  /* ⑤ 彻底移除无用的免责边界卡片（用户要求删掉纯噪音内容，遵守 DESIGN.md 删元素同时删死样式规则） */
  assert.doesNotMatch(htmlCode, /class="health-scope"/,
    '冗余无用的「自动修复边界」静态介绍卡片应从页面中彻底移除');
  assert.doesNotMatch(css, /\.health-scope\b/,
    'styles.css 不应再遗留 .health-scope 相关的死样式');
});

test('the toolbar stylesheet carries no selector for markup this page no longer has', () => {
  /* 第 28 轮：写上面那条测试时靠"锚行首"的改动，顺手暴露了两个真实缺陷 ——
   * 它们都属于 DESIGN.md §六.8 那句"删元素时必须同时删样式，
   * 否则样式会骗人（读代码的人以为存在这类元素）"：
   *
   *   ① `.icon-button` 还挂在 browser.css 的一条联合规则里，
   *      但 browser.css **只服务 browser.html**，而那里已无任何 .icon-button
   *      （它是 36×36 的通用图标按钮，活在 styles.css、服务 index.html）。
   *   ② `.add-workspace` 被硬塞进同一条顶栏联合规则，与它在工作区那一行的
   *      真规则同特异性 —— `background` 一个 transparent 一个深色，
   *      谁生效只取决于书写顺序。棘轮也独立证实了后半段：
   *      删掉重复声明前，no-duplicate-selectors 报 .manager-button 139 → 140。
   *
   * 所以这条测试守两件事：本页样式不得出现无元素的类名，且同一选择器
   * 不得因拆成"底座一条 + 配色一条"而重复出现。
   *
   * 注意动态拼类名：browser.js 里可能用 className= 造类名，
   * 只在 HTML 里搜会得出错误的"死"结论 —— 与 styles.css 那条测试同一口径。 */
  const css = read('renderer/browser.css');
  const html = read('renderer/browser.html');
  const js = read('renderer/browser.js');

  /* ★ 判据前必须剥注释 —— 三处来源都要剥。
   *   browser.html 的说明文字里写着"原先 .icon-button"，browser.css 里
   *   写着"已无任何 .icon-button"，browser.js 里写着"不再绑定 #homeButton"。
   *   不剥的话，正是这些**解释缺陷的注释**会把测试判红（本项目已栽过多次）。 */
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  const cssCode = strip(css);
  const htmlCode = strip(html);
  const jsCode = strip(js);

  for (const cls of ['icon-button']) {
    const inHtml = htmlCode.includes(cls);
    const inJs = new RegExp(`['"\`][^'"\`]*\\b${cls}\\b`).test(jsCode);
    assert.ok(!inHtml && !inJs,
      `${cls} 在本页已无对应元素（它属于 index.html 的 styles.css），不应留在 browser.css`);
    assert.doesNotMatch(cssCode, new RegExp(`\\.${cls}\\b`), `browser.css 不应再有 .${cls}`);
  }

  /* .manager-button 是顶栏真实存在的元素（browser.html 的 #managerButton），
   * 但它的完整外观必须只在一条规则里 —— 曾经拆成"底座 + 配色"两条。 */
  const managerRules = [...css.matchAll(/^\.manager-button\{[^}]*\}/gm)].map((m) => m[0]);
  assert.match(html, /id="managerButton" class="manager-button"[^>]*>.*<svg.*设置.*<\/button>/s,
    '.manager-button 应挂在顶栏「设置」上，且包含矢量齿轮图标和设置文本');
  assert.equal(managerRules.length, 1,
    '.manager-button 应只有一处定义 —— 拆成两条会让同特异性声明互相覆盖');
  assert.match(managerRules[0], /background:var\(--control-bg\)/,
    '★ 「设置」应具有轻实体底色，确保用户能一眼识别');
  assert.match(managerRules[0], /height:34px/,
    '★ 设置按钮高度为 34px —— 保证充足的点击区域与易读性');
  assert.match(css, /\.manager-button:hover\{[^}]*background:var\(--control-hover\)/,
    '设置按钮必须有 Hover 背景反馈');

  /* ★ 第 32 轮新增：被删掉的结构不得留下样式。
   * 这是 DESIGN.md §六.8 那条规则（"删元素时必须同时删样式，否则样式会骗人"）
   * 在**本轮**的具体落点 —— 本轮删掉的结构比任何一轮都多：
   *   .workspace-bar-title / .workspace-label / .workspace-picker /
   *   .workspace-picker-icon / .task-body / .task-line
   * 每一类都曾经有不止一条规则（含 ::after、:hover、i、span 等派生选择器），
   * 逐条删是唯一安全的做法；漏一条读代码的人就会以为那些元素还在。 */
  for (const cls of ['workspace-bar-title', 'workspace-label', 'workspace-picker-icon', 'task-body', 'task-line']) {
    assert.doesNotMatch(cssCode, new RegExp(`\\.${cls}\\b`),
      `browser.css 不应再有 .${cls} —— 第 32 轮已把对应结构合并/删除（${cls} 在本页已无元素）`);
  }
  /* .workspace-picker 是特例：本页（browser.html）已无此类名，但**设置页**
   * （renderer/styles.css 的 .workspace-picker 面板）仍在用同一个类名 ——
   * 两套 CSS 隔离在各自的原生视图里，所以这里只能断言"browser.css 里没有"，
   * 不能断言"全仓库没有"。这一条正好说明为什么判据要按文件收窄。 */
  assert.doesNotMatch(cssCode, /\.workspace-picker\b/,
    'browser.css 不应再有 .workspace-picker（它已并进工作区菜单；'
    + '注意 styles.css 里的同名类是设置页的工作区面板，与本页无关）');
});

test('browser.css declares its own token layer instead of scattering literals', () => {
  /* 第 28 轮：browser.css 不加载 design-tokens.css（两套表面色同名不同值，
   * 同时加载会让颜色全乱 —— 见 DESIGN.md §一），所以它的色值/字号本来
   * 只能写字面量，代价是"改了没法定中间量"且每写一个 hex 就多一条棘轮违规。
   *
   * 本轮要重做工具栏三块，直接写字面量会新增违规，而棘轮判据是
   * "每条提示文本的计数不得超基线" —— 新增 hex 必被拦下。
   * 所以在 :root 集中声明一次、使用点改引用 var()，净效果是**收紧**
   * （实测：178 → 139）。
   *
   * 这条测试守三件事：
   *   ① 令牌真的声明了（不是只在使用点写 var() —— 那会让整条声明失效，
   *      因为未定义变量在 CSS 里是"整条声明丢弃"，不是"回退默认值"）；
   *   ② 使用点真的在用它（否则令牌是死代码）；
   *   ③ 无自引用 —— 本轮批量替换时曾把 :root 里的
   *      `--control-bg:#fff` 自己替换成 `--control-bg:var(--control-bg)`，
   *      那会让这组令牌全部失效且**不报错**（最难查的一类）。
   *      这是那次真实事故留下的护栏。 */
  const css = read('renderer/browser.css');
  const root = css.match(/:root\{[\s\S]*?\}/)?.[0];
  assert.ok(root, 'browser.css 应有自己的 :root 令牌块');

  const tokens = ['--fs-xs', '--fs-sm', '--fs-base', '--fs-lg',
    '--control-bg', '--control-border', '--control-text', '--control-hover', '--control-disabled',
    '--track', '--sunken', '--sunken-text', '--dot',
    '--accent-soft-bg', '--accent-soft-text', '--radius-sm', '--radius-md', '--radius-lg'];

  const missing = tokens.filter((t) => !new RegExp(`\\${t}:\\s*[^;]`).test(root));
  assert.equal(missing.length, 0, `browser.css 的 :root 缺少令牌声明：${missing.join(', ')}`);

  /* ★ 无自引用：--x: var(--x) 会让令牌失效且不报错（最难查的一类） */
  const selfRef = tokens.filter((t) => new RegExp(`\\${t}:\\s*var\\(\\${t}\\)`).test(root));
  assert.equal(selfRef.length, 0,
    `令牌指向自己会导致整组失效且不报错：${selfRef.join(', ')}`);

  /* 使用点确实在引用（避免令牌成为死代码） */
  const body = css.slice(css.indexOf(root) + root.length);
  for (const t of ['--control-bg', '--control-border', '--fs-sm', '--radius-md']) {
    assert.ok(body.includes(`var(${t})`), `${t} 应在使用点被引用，否则是死令牌`);
  }

  /* 字号尺度必须与 design-tokens.css 一致 —— 两套样式体系在
   * "文字大小"这一维度上不能互相矛盾（否则同一个 13px 在两个视图里叫两个名字）。 */
  const design = read('renderer/design-tokens.css');
  for (const [name, value] of [['--fs-xs', '12px'], ['--fs-sm', '13px'], ['--fs-base', '14px'], ['--fs-lg', '20px']]) {
    assert.ok(new RegExp(`\\${name}:\\s*${value}`).test(root),
      `${name} 在 browser.css 里必须等于 design-tokens.css 的 ${value}`);
    assert.ok(new RegExp(`\\${name}:\\s*${value}`).test(design),
      `design-tokens.css 里 ${name} 应为 ${value}`);
  }
});

test('the deleted hero connection diagram does not come back as a hidden stub', () => {
  /* 第 41 轮（用户决策：首页连接示意图**彻底删掉**）。
   *
   * 原判据是「三个图标大小必须一致」（"本地工具的图标感觉比旁边两个小一些"）——
   * 那条判断的落点已经从三节点流程图换成「当前状态」三行列表，并由
   * 「the three overview flow icons occupy the same visual box」那条测试
   * 在新结构上完整承担（三行内部结构逐项相同 + 三处箭头路径逐字相同 +
   * 三条尺寸规则唯一）。所以这里**不再重复**那个判断。
   *
   * 这条测试守的是删除动作本身，因为这个项目最常犯的错不是"删错"，
   * 而是"删了一半"：元素从可见处拿掉、却留一个 hidden 的壳，
   * 于是将来任何人去掉那个 hidden，废弃形态就复活了（README 里点名的
   * "假护栏"形态）。所以三类痕迹都要清零：
   *   ① 标记里不得再有 .connection-visual / .node / .flow-line；
   *   ② 样式表里不得再有它们的规则（死 CSS 会骗读代码的人"元素还在"）；
   *   ③ 兼容隐藏块里不得再出现同名字符串。 */
  const html = read('renderer/index.html');
  const css = read('renderer/styles.css');
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');

  assert.doesNotMatch(html, /connection-visual/,
    '首页连接示意图已整块删除，标记里不得再出现它的容器名');
  assert.doesNotMatch(html, /class="flow-line/,
    '连接示意图的连线也已删除 —— 留一个 hidden 的壳等于给废弃形态留暗门');
  assert.doesNotMatch(cssCode, /\.connection-visual/,
    '连接示意图的样式必须一同删除 —— 死 CSS 会让人以为元素还在');
  assert.doesNotMatch(cssCode, /\.flow-line/,
    '连线的样式也必须一同删除');
  assert.doesNotMatch(cssCode, /\.node\s*\{/,
    '示意图三个节点的 .node 规则必须一同删除（本页没有其它 .node 消费者）');
});

test('the build capability stays an in-page section instead of a nav page', () => {
  /* 第 28 轮：用户第 1 条「构建与验证有什么用？」→ 决策「降成区块」。
   *
   * 这条测试守的是**降级不能变成删除**：
   *   侧栏项没了、独立页没了，但"识别项目 → 跑测试 → 跑构建 → 校验产物"
   *   这条链路必须还活着，且仍有按钮能触发它。
   * 只断言"data-page=build 不存在"是不够的 —— 把整块删掉同样能通过。
   *
   * ★ 第 41 轮（用户口径：「高级设置在偏好板块」）：这一块**留在偏好设置页**
   *   （偏好设置 → 高级设置里的「构建与验证」），不再搬回任务页。
   *   第 28 轮决策真正反对的是"为它单开一个侧栏页面"（把工具能力做成导航目的地），
   *   "落在某个页面内部的区块里"这半边照样成立。所以判据从"必须在任务页"
   *   改成**"必须整块在同一个页面容器内"**：
   *     一半在任务页、一半留在别处的中间态才是要拦的东西。 */
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  const htmlCode = html.replace(/<!--[\s\S]*?-->/g, '');
  const appCode = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

  /* ① 切片：任务页以 health 页为右边界；偏好设置页以 about 页为右边界
   *    （原来的正则用 `</section>` 收尾，而设置页里有嵌套 section，
   *    切到第一个内层结束标签就断了 —— 用下一页的 data-page-view 做边界才稳）。
   *    ★ 判据用**稳定的 id**（#buildProjectType / #inspectBuild / #runBuild /
   *      #buildReport），不用已被改名的 class（"panel build-section" 已不存在）
   *      与标题文案。 */
  const taskSection = htmlCode.match(
    /<section class="page" data-page-view="task"[^>]*>([\s\S]*?)<section class="page" data-page-view="health"/);
  assert.ok(taskSection, '应能截出任务页正文（以 health 页为右边界）');
  const settingsSection = htmlCode.match(
    /<section class="page" data-page-view="settings"[^>]*>([\s\S]*?)<section class="page" data-page-view="about"/)?.[1] || '';
  assert.ok(settingsSection, '应能截出偏好设置页正文（以 about 页为右边界）');
  const whereIs = (id) => (taskSection[1].includes(`id="${id}"`) ? '任务页'
    : (settingsSection.includes(`id="${id}"`) ? '偏好设置页'
      : (htmlCode.includes(`id="${id}"`) ? '其它页面/隐藏兼容桩' : '整页均未找到')));
  const buildHome = taskSection[1].includes('id="buildProjectType"') ? '任务页' : '偏好设置页';
  const buildHost = buildHome === '任务页' ? taskSection[1] : settingsSection;
  for (const id of ['buildProjectType', 'inspectBuild', 'runBuild', 'buildReport']) {
    assert.match(buildHost, new RegExp(`id="${id}"`),
      `构建与验证的四个稳定 id 必须**同处一个页面**里的一个区块：缺少 #${id}`
      + `（现位置：${whereIs(id)}；已确认的落点是「${buildHome}」）`
      + ' —— 一半在这个页面、一半在别处说明这次搬迁只做了一半');
  }

  // ② 触发入口必须存在且有处理器绑定（没有绑定的按钮等于装饰）
  /* 绑定允许写成 `?.addEventListener` —— 这条判据要守的是"事件真的接上了"，
   * 不是"有没有写可选链"。两处绑定的形式必须一致地允许（另一半判据同此）。 */
  for (const id of ['inspectBuild', 'runBuild']) {
    assert.match(buildHost, new RegExp(`id="${id}"`), `${id} 必须仍在同一个构建区块里`);
    assert.match(appCode, new RegExp(`\\$\\('#${id}'\\)\\?*\\.addEventListener`), `${id} 必须有事件绑定`);
  }

  /* ③ 全页只允许一份这些 id。
   * 这是"降级"这个动作**最容易留下**的隐患：新区块是从旧页抄过来的，
   * 抄完忘了删旧页，于是同一 id 出现两次。浏览器不会报错 ——
   * querySelector 只认第一个，第二份成为永不更新的僵尸节点，
   * 用户看到的是"有两块构建面板，其中一块永远停在'等待识别'"。 */
  const countId = (source, id) => (source.match(new RegExp(`id="${id}"`, 'g')) || []).length;
  for (const id of ['buildProjectType', 'inspectBuild', 'runBuild', 'buildPlanProject', 'buildPlanTest',
    'buildPlanBuild', 'buildPlanArtifacts', 'buildTestCommand', 'buildCommand', 'buildArtifacts',
    'buildRunTests', 'buildRunBuild', 'buildStatus', 'buildConsole', 'buildReportStatus', 'buildReport']) {
    assert.equal(countId(htmlCode, id), 1,
      `#${id} 在全页必须恰好出现一次 —— 重复 id 不会报错，只会让第二份永远不更新`);
  }

  // ④ navigate() 必须把「识别项目」挂到任务页，否则新区块永远停在"未识别"
  assert.match(appCode, /if \(page === 'task'\)[\s\S]{0,200}?inspectBuild\(\)/,
    '进入任务页时要触发一次项目识别，否则新区块没有时机去问后端');
  assert.doesNotMatch(appCode, /page === 'build'/, 'build 已不是页面，不应再有它的派发分支');

  /* ⑤ 识别只能做一次。inspectBuild() 会重置三个命令输入框，
   * 每次切页都跑会把用户手填的覆盖命令悄悄清掉。 */
  assert.match(appCode, /if \(!state\.buildInspected\)/, '项目识别必须只做一次，不能每次进页都重置用户填的命令');
  assert.match(app, /buildInspected: false/, 'state 里应有 buildInspected 标记');
});

test('the two build report shapes normalize into one renderer, so neither side shows blank', () => {
  /* 第 28 轮：用户决策「合并成一块」后，同一个 #buildReport 要吃两份数据 ——
   *
   *   手动验证 build:run  → camelCase { overallStatus, testResult, buildResult }
   *   任务自动记录        → snake_case { overall_status, test_results, build_results }
   *
   * ★ 这是本轮最容易"静默坏掉"的地方：喂错形状**不报错**，
   *   overallStatus 取到 undefined → 状态文案被判成 falsy 显示"验证失败"，
   *   产物列表空掉。看起来就像"这次验证没跑过"，而磁盘上明明有记录。
   *
   * 所以这条测试不是读源码做正则，而是把 normalizeBuildReport 抠出来
   * **在沙箱里真跑**两份真实形状的数据，比较归一化后的输出。 */
  const app = read('renderer/app.js');
  const body = app.match(/function normalizeBuildReport\(report\) \{([\s\S]*?)\n\}/);
  assert.ok(body, '应能在 app.js 里找到 normalizeBuildReport');
  const vm = require('node:vm');
  const normalize = vm.runInNewContext(`(function(report){${body[1]}})`);

  // 形状 A：手动验证（camelCase）
  const manual = normalize({
    overallStatus: 'passed',
    project: { name: 'demo', type: 'node', version: '1.2.3' },
    testResult: { status: 'passed' },
    buildResult: { status: 'passed' },
    artifacts: [{ path: 'dist/a.js', size: 10, sha256: 'abc' }]
  });
  // 形状 B：任务自动记录（snake_case，且测试/构建是**数组**流水）
  const task = normalize({
    overall_status: 'passed',
    project: { name: 'demo', type: 'node', version: '1.2.3' },
    test_results: [{ status: 'passed' }, { status: 'failed' }],
    build_results: [{ status: 'passed' }],
    artifacts: [{ path: 'dist/a.js', size: 10, sha256: 'abc' }]
  });

  for (const [label, value] of [['camelCase', manual], ['snake_case', task]]) {
    assert.ok(value, `${label} 形状必须能归一化出结果（返回 null 会让报告区显示成"没跑过"）`);
    assert.equal(value.overallStatus, 'passed', `${label} 的总体状态被丢了`);
    assert.equal(value.project.name, 'demo', `${label} 的项目信息被丢了`);
    assert.ok(value.testStatus, `${label} 的测试状态被丢了`);
    assert.ok(value.buildStatus, `${label} 的构建状态被丢了`);
    assert.equal(value.artifacts.length, 1, `${label} 的产物列表被丢了`);
  }
  /* 数组取**末项**而不是首项：test_results 是追加式的执行流水，
   * 最后一次的结果才代表现状。取首项会让"修好之后再跑一次"仍显示失败。 */
  assert.equal(task.testStatus, 'failed',
    '任务侧的 test_results 是流水，应取最后一笔（用户关心的是最新一次）');

  // 三种摘要算法都要认：任务侧记录可能只带 sha384 / sha512
  assert.match(app, /artifact\.sha256 \|\| artifact\.sha384 \|\| artifact\.sha512/,
    '产物摘要要同时认 sha256 / sha384 / sha512 —— 只读 sha256 会把另两种显示成空码');

  // 空态必须能被识别，否则会留着上一次的结论冒充当前任务的结果
  assert.equal(normalize(null), null);
  assert.equal(normalize({}), null, '没有 overall 字段的记录应视为"没有报告"');
});

test('the task page hands its archived build report to the shared renderer, guarded and field-correct', () => {
  /* 第 28 轮实测抓出的真 BUG：renderTaskState 尾部第一次写成
   *     renderBuildReport(report || null, { source: 'task' });
   * 而 report 在这个作用域里**根本不存在** → 每次渲染任务状态都抛
   * ReferenceError。异常被 loadTaskState 的 try/catch 吞掉，
   * 只弹一句"任务状态读取失败"，表现是整个任务页半截不刷新 ——
   * 看起来像后端没数据，实际是前端崩了。
   *
   * 所以这里必须断言**字段名**（task.last_build_report，snake_case）
   * 与**守卫条件**（有记录才覆盖）两件事。 */
  const app = read('renderer/app.js');

  assert.match(app, /if \(task\?\.last_build_report\) renderBuildReport\(task\.last_build_report, \{ source: 'task' \}\)/,
    '任务页必须把 task.last_build_report 转交给统一渲染器（字段名是 snake_case 的 last_build_report）');
  /* 裸 report 变量不存在 —— 这是上面那个崩溃的直接写法，禁止回潮 */
  assert.doesNotMatch(app, /renderBuildReport\(report \|\| null/,
    'renderTaskState 里没有 report 变量，裸用会抛 ReferenceError 并被 catch 吞掉');

  /* 守卫不能省。取消它会带来一个很隐蔽的坏结果：
   * 任务没跑过构建时（null）把手动验证刚出的结果擦成占位文字，
   * 用户点完「开始验证」看到结果，一切页再回来就没了。 */
  assert.doesNotMatch(app, /renderBuildReport\(task\?\.last_build_report \|\| null/,
    '无记录时必须**不调用**，而不是用 null 调一次把已有结果清掉');

  /* 两个来源都要能标出来源，否则用户分不清"这份是任务跑的"还是"我自己点的" */
  const vm = require('node:vm');
  const html = read('renderer/index.html');
  assert.match(html, /id="buildReportSource"/, '需要一块专门显示报告来源的位置');
  assert.match(app, /来自任务执行时自动记录/);
  assert.match(app, /来自你手动执行的验证/);
  assert.match(app, /source === 'task'/, '来源文案必须按 source 分支，不能用同一句话糊过去');
  void vm;
});

test('the history-delete key format is identical on both sides of the IPC boundary', () => {
  /* 第 28 轮：用户第 3 条「历史任务……可以隐藏或者删除」。
   *
   * 删除是 renderer 说"删哪个"、主进程按 key 过滤。两边的 key 必须**逐字一致**：
   *   renderer: taskHistoryKey(task)  → 'id:xxx' / 'at:yyy' / null
   *   main:     historyKeyOf(item)    → 'id:xxx' / 'at:yyy' / null
   *
   * ★ 这是一个**跨进程契约**，而调用方与实现在两个文件里，没有任何机制
   *   保证它们同步。漂移后的表现极其安静：不报错，只是 removed 永远是 0，
   *   前端于是弹一句"这条记录已不在历史里" —— 用户会以为是列表过期了。
   *   所以必须把两份实现抠出来真跑，逐例比对输出。
   *
   * 为什么键要带前缀（id: / at:）而不是裸 id：
   *   task_id 与 archived_at 是两种不同来源的回退，若都裸放，
   *   一条 task_id 恰好等于另一条的 archived_at 就会互删。 */
  const app = read('renderer/app.js');
  const main = read('electron/main.js');
  const vm = require('node:vm');

  const rendererBody = app.match(/function taskHistoryKey\(task\) \{([\s\S]*?)\n\}/);
  assert.ok(rendererBody, '应能在 app.js 里找到 taskHistoryKey');
  const mainBody = main.match(/const historyKeyOf = \(item\) => \{([\s\S]*?)\n  \};/);
  assert.ok(mainBody, '应能在 main.js 里找到 historyKeyOf');

  const rendererKey = vm.runInNewContext(`(function(task){${rendererBody[1]}})`);
  const mainKey = vm.runInNewContext(`(function(item){${mainBody[1]}})`);

  const cases = [
    { name: '有 task_id', item: { task_id: 't-1', archived_at: '2026-01-01T00:00:00Z' }, want: 'id:t-1' },
    { name: '无 task_id 但有归档时间', item: { archived_at: '2026-01-01T00:00:00Z' }, want: 'at:2026-01-01T00:00:00Z' },
    { name: 'task_id 是空字符串（要退回时间）', item: { task_id: '  ', archived_at: '2026-01-01T00:00:00Z' }, want: 'at:2026-01-01T00:00:00Z' },
    { name: '两者都缺 → 无法定位', item: {}, want: null },
    { name: 'task_id 是数字（要转成字符串）', item: { task_id: 42 }, want: 'id:42' },
    { name: '非对象', item: null, want: null },
    { name: '字符串', item: 'oops', want: null }
  ];

  for (const { name, item, want } of cases) {
    assert.equal(rendererKey(item), want, `renderer 侧 key 不符（${name}）`);
    assert.equal(mainKey(item), want, `主进程侧 key 不符（${name}）`);
    assert.equal(rendererKey(item), mainKey(item),
      `★ 两侧 key 必须逐字一致，否则删除会静默失败（${name}）`);
  }
});

test('history deletion only ever touches the history file, and re-reads it before writing', () => {
  /* 第 3 条要求"可以隐藏或者删除"。这条守两个安全属性：
   *
   * ① **只动历史文件**。删除历史最容易踩的坑是顺手把当前任务状态也清了 ——
   *    用户明确要的是"这条历史别再显示"，不是"把我正在跑的任务抹掉"。
   *    所以处理器体内不得出现 statePath / clearTaskState 那套写入。
   *
   * ② **每次重读磁盘再写**，而不是用 renderer 回传的整份列表覆盖。
   *    task-history.json 有**两个写入方**（本进程 + 本地工具的
   *    TaskStateStore._archive）。若按 renderer 手里的副本整体覆盖，
   *    会静默丢掉 MCP 侧在此期间新归档的记录 —— 表现为"删一条，丢几条"。
   *
   * 注意断言前要按**处理器边界**截正文：直接在全文件范围搜 statePath
   * 会读到上面那些 task-state:pause / stop 处理器，永远匹配成功。 */
  const main = read('electron/main.js');

  const removeHandler = main.match(
    /secureHandle\('task-state:history-remove'[\s\S]*?\n  \}\)\);/);
  assert.ok(removeHandler, '应能截出 history-remove 处理器正文');
  const clearHandler = main.match(
    /secureHandle\('task-state:history-clear'[\s\S]*?\n  \}\)\);/);
  assert.ok(clearHandler, '应能截出 history-clear 处理器正文');

  for (const [label, body] of [['history-remove', removeHandler[0]], ['history-clear', clearHandler[0]]]) {
    assert.ok(body.includes('historyPath'), `${label} 必须操作 historyPath`);
    assert.ok(!body.includes('statePath'),
      `★ ${label} 不得触碰 statePath —— 删历史不能连带清掉当前任务状态`);
    assert.ok(/readJson\(historyPath/.test(body),
      `★ ${label} 必须先读磁盘再写（renderer 手里的列表可能已过期，整体覆盖会丢 MCP 侧新归档的记录）`);
    assert.ok(!/\bargs\b|\bpayload\b|\bitems\s*\)\s*\{/.test(body) || /readJson\(historyPath/.test(body),
      `${label} 不应信任 renderer 回传的列表内容`);
  }

  // 半截写入防护：必须走原子写（临时文件 + rename），不能裸 fs.writeFile
  assert.ok(/writeJsonAtomic\(historyPath/.test(removeHandler[0]),
    'history-remove 必须用 writeJsonAtomic（临时文件 + fsync + rename），避免留下半截 JSON');
  assert.ok(/fs\.rm\(historyPath/.test(clearHandler[0]),
    'history-clear 应删除文件而不是写入空数组 —— 下次读取靠 ENOENT 返回空列表');

  // 空 key 必须被拒，否则 filter 会命中"所有 key 为 null 的坏记录"批量误删
  assert.match(removeHandler[0], /if \(!wanted\) throw/,
    '缺少 key 时必须报错拒绝 —— 空 key 会匹配到所有无法定位的记录，变成批量误删');
});

test('history rows expose a per-row delete and a clear-all, and explain what they do not touch', () => {
  /* 用户原话「历史任务不能怎么搞，而且可以隐藏或者删除」：
   *   "不能怎么搞" = 原来除了"清除任务状态"没有任何管理入口。
   * 这条守三个点：
   *   ① 每条记录有独立删除按钮（不是只能全清）；
   *   ② 有全清入口（攒到 100 条时逐条点不现实）；
   *   ③ 破坏性操作必须有 confirm，且文案要说清"不影响当前任务状态" ——
   *      否则用户会以为它与上面那个「清除任务状态」是同一个东西。
   *      那两个按钮名字很像，而行为差别很大。 */
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  const preload = read('electron/preload.js');

  assert.match(html, /id="clearTaskHistory"/, '需要「清空历史」入口');
  assert.match(html, /id="taskHistory"/, '需要有历史列表容器');
  /* ★ 「说明文案」这一条的落点换了：面板上的说明句被界面重写删掉，
   *   但同一件事仍写在**清空历史的 confirm 里**（而且那才是用户读到的
   *   最后一句话，比面板说明更关键）。原意图不变：必须写清
   *   "删历史 ≠ 清任务状态"。 */
  assert.match(app, /确定清空全部历史任务记录吗？[\s\S]{0,90}?只删除归档的历史，不会改动当前任务状态/,
    '破坏性操作必须写清"删历史 ≠ 清任务状态"（两个入口名字很像，行为差别很大）');

  assert.match(app, /task-history-remove/, '每条记录要有一个删除按钮的类名');
  assert.match(app, /api\.removeTaskHistory\(key\)/, '单条删除要调 removeTaskHistory');
  assert.match(app, /api\.clearTaskHistory\(\)/, '全清要调 clearTaskHistory');
  assert.match(app, /if \(!confirm\(/, '清空是破坏性操作，必须有确认');

  /* 缺 key 的记录不能给一个点了没反应的按钮 —— 必须置灰并说明原因 */
  assert.match(app, /remove\.disabled = true/);
  assert.match(app, /这条记录缺少标识，无法单独删除；可用「清空历史」/,
    '无法单独删除的记录要说明原因并指出替代路径，不能只是灰着');

  // 桥接必须真的把它暴露出去（只写 renderer 调用 = 点了直接 TypeError）
  assert.match(preload, /removeTaskHistory:\s*\(key\)\s*=>\s*ipcRenderer\.invoke\('task-state:history-remove'/);
  assert.match(preload, /clearTaskHistory:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('task-state:history-clear'/);

  /* 预览桩（浏览器里直接开 index.html 时用的纯内存 API）也要补上这两个方法。
   * 不补的话，在预览环境点删除会抛 "api.removeTaskHistory is not a function" ——
   * 而这正是开发时最常用的查看方式。 */
  assert.match(app, /removeTaskHistory: \(\) => ok\(1\)/, 'createPreviewApi 必须补 removeTaskHistory 桩');
  assert.match(app, /clearTaskHistory: \(\) => ok\(0\)/, 'createPreviewApi 必须补 clearTaskHistory 桩');
});

test('the task page panels and history rows carry the exact wiring the round-28 requirements need', () => {
  /* 第 28 轮这批断言的由来：负向验证（_negtest-round28.js）抓到
   * **4 条假护栏** —— 把源码改坏了测试却仍然全绿。四条都是同一个毛病：
   * 断言写得太宽松，只检查"文件里出现过某个词"，而不检查"那句话本身写对没有"。
   *
   *   ① history-remove 的过滤没用 historyKeyOf（删不掉任何东西）
   *   ⑩ 构建区块被挪回 #taskStateContent 里（无任务时整块被 hidden）
   *   ⑭ 后台任务面板不再按需收起（空面板常驻占位）
   *   ⑮ 缺键的历史行按钮不禁用（看着能点、点了没反应）
   *
   * 教训：**只断言关键词存在是无效护栏**。要断言完整的赋值/调用语句本身，
   * 才挡得住"值被换掉、条件被取反、整行被删"这三类改坏方式。
   * 每加一条断言，都必须能说出"把它改坏，哪条断言会红"。 */
  const app = read('renderer/app.js');
  const main = read('electron/main.js');
  const html = read('renderer/index.html');
  const htmlCode = html.replace(/<!--[\s\S]*?-->/g, '');

  /* ── ① 主进程的删除必须真的按 key 过滤 ──────────────────────────
   * 原来只断言了"读过 readJson、写过 writeJsonAtomic、空 key 会报错"，
   * 于是把 filter 换成 () => true（一条都删不掉）仍能通过。 */
  assert.match(main, /const kept = items\.filter\(\(item\) => historyKeyOf\(item\) !== wanted\);/,
    '★ 删除必须按 historyKeyOf 过滤。写成 () => true 会静默返回 removed=0，'
    + '界面弹"这条记录已不在历史里"，而磁盘上一条都没少');
  assert.match(main, /const removed = items\.length - kept\.length;/,
    '返回值必须是"真的少了几条"，不能写死 0 或 1');

  /* ── ⑭ 面板按需收起的三处赋值必须逐字存在 ────────────────────── */
  /* ★ 这一条原来是**假绿**：只断言 JS 里那行赋值存在，而 #taskOperationsPanel
   *   这个容器在界面重写时已经从 index.html 里删掉了。元素不存在时
   *   `$()`（裸 querySelector）返回 null，那行赋值会在运行时抛 TypeError
   *   —— 或者被外层 catch 静默吞掉，整段任务渲染直接跳过。
   *   所以必须**两端都断言**：容器真实存在 + JS 按数量收起。 */
  assert.match(htmlCode, /id="taskOperationsPanel"/,
    '★ 后台任务面板的容器必须真实存在 —— 元素被删掉后 $() 返回 null，'
    + '那行赋值会抛 TypeError（假护栏：只查 JS 那行，容器没了也照样绿）');
  assert.match(app, /\$\('#taskOperationsPanel'\)\.hidden = operations\.length === 0;/,
    '★ 后台任务面板必须按 operations 数量收起 —— 空面板常驻会把有内容的区块挤下去');
  assert.match(htmlCode, /id="taskWorktreesPanel"/,
    '★ 安全隔离区的容器必须真实存在（同样不能用"JS 里有赋值"替代）');
  assert.match(app, /\$\('#taskWorktreesPanel'\)\.hidden = worktrees\.length === 0;/,
    '★ 安全隔离区必须按 worktrees 数量收起');
  /* ★ 第 29 轮（用户第 6 条「任务历史需要可隐藏和可删除」）改写了这一处：
   *   原断言锁的是 syncTaskHistoryPanel 里那一行字面写法：
   *     panel.hidden = container.querySelectorAll('.task-history-item').length === 0;
   *   但那一行现在被 applyTaskHistoryVisibility 接管了 —— 因为面板的显隐
   *   要同时满足两个条件（"有没有记录" **与** "用户有没有收起"），
   *   塞在一个表达式里会写成 panel.hidden = 空 || 收起，
   *   而这两个条件的来源不同（DOM 现状 vs localStorage 偏好），
   *   合在一起就没法单独验证其中任何一个。
   *
   *   原断言的**本意**是"必须按 DOM 里的实际行数判断，而不是用事件参数里的长度"
   *   （单条删除是局部移除、不重新拉取，参数长度会过期）。这个本意必须保留，
   *   只是判据要跟着实现走。 */
  assert.match(app, /const hasItems = container \? container\.querySelectorAll\('\.task-card-row, \.task-history-item'\)\.length > 0 : false;/,
    '★ 历史面板仍必须按 DOM 里的实际行数判断 —— 单条删除是局部移除、不重新拉取，'
    + '用事件参数里的长度会拿到过期值'
    + '（行类名现为 .task-history-item **与 .task-card-row** 两种，判据必须同时认）');
  /* 两个条件必须分别成立 —— 写成一个表达式会让"用户点了展开但没有记录"
   * 出现打架（点了立刻被数据条件收回去）。
   *
   * ★ 第 30 轮（用户第 2 条「历史清除了怎么整个部分都没有了」）改写了这里的
   *   落笔方式：面板**不再由数据决定显隐**。改前是
   *     panel.hidden = !hasItems;  body.hidden = !hasItems || collapsed;
   *   —— 一条记录都没有时整块面板消失，连带标题、说明、「收起」和
   *   「清空历史」一起没了。用户清空历史后看到的是这块区域凭空不见，
   *   既没有"已清空"的反馈，也没地方确认以后还会不会再记录。
   *
   *   现在：panel 常驻（它属于页面固定结构，不属于数据），
   *   数据条件只决定 body 里显示列表还是空态。
   *   原断言的**本意**——"两个条件的来源不同（DOM 现状 vs localStorage
   *   偏好），必须分别算"——照样成立，只是 panel 不再参与那个"与"关系了。
   *   所以判据改成：body 由收起态决定，而 panel 必须显式常驻。 */
  assert.match(app, /panel\.hidden = false;/,
    '★ 面板必须常驻 —— 数据空了就整块消失，用户会以为功能坏了（第 2 条原话'
    + '「历史清除了怎么整个部分都没有了」）');
  assert.doesNotMatch(app, /panel\.hidden = !hasItems;/,
    '★ 不得退回"没有记录就整块隐藏" —— 那正是用户抱怨的行为');
  assert.match(app, /body\.hidden = collapsed;/,
    '★ 收起态必须让 body 真的 hidden（只改类名不改 hidden 的话 333px 还在）');
  assert.match(app, /panel\.classList\.toggle\('collapsed', collapsed\);/,
    '★ 收起时面板要带 .collapsed —— CSS 靠它把说明文字一并收起');
  /* 没有记录时两个动作按钮都该禁用：留着可点会让用户以为"点了没反应" */
  assert.match(app, /if \(clear\) clear\.disabled = !hasItems;/,
    '★ 「清空历史」在没有记录时必须禁用 —— 否则用户点了看不到任何变化');

  /* ── ⑮ 缺键记录必须被禁用并给出替代路径 ──────────────────────── */
  /* 这里必须带 if (!key) 上下文：remove.disabled = true 在文件里有两处
   * （另一处在点击处理器内部"防重复点"），单独搜会匹配错那一处。 */
  assert.match(app, /if \(!key\) \{\s*remove\.disabled = true;\s*remove\.title = '这条记录缺少标识，无法单独删除；可用「清空历史」';/,
    '★ 缺键的记录必须禁用删除按钮并说明替代路径 —— 否则按钮看着能点、点了没反应');

  /* ── ⑩ 构建区块必须在 #taskStateContent 之外 ────────────────────
   * 这是"降级"与"删除"的分界线，也是本轮唯一只能靠**结构**判定的点。
   * 用括号配对扫描找出 #taskStateContent 的闭合位置，再比较索引 ——
   * 光assert"build-section 在 task 页里"挡不住"挪进 hidden 容器"这种改坏。 */
  /* ★ 第 41 轮重锚：原判据直接在标记里找 `<div id="taskStateContent"`，
   *   而界面重写给这个容器加了 class（`<div class="task-active-card" id="taskStateContent"`），
   *   字面量匹配立刻变成"找不到容器"这种与真实缺陷无关的假红。
   *   先按 id 定位，再往回找最近的 <div 开标签 —— 属性顺序变了也不受影响。 */
  const idIdx = htmlCode.indexOf('id="taskStateContent"');
  assert.ok(idIdx >= 0, '应能找到 #taskStateContent');
  const openIdx = htmlCode.lastIndexOf('<div', idIdx);
  assert.ok(openIdx >= 0, '应能找到 #taskStateContent 的开标签');
  let depth = 0; let closeIdx = -1;
  const tagRe = /<div\b[^>]*>|<\/div>/g;
  tagRe.lastIndex = openIdx;
  for (let m = tagRe.exec(htmlCode); m; m = tagRe.exec(htmlCode)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) { closeIdx = m.index; break; }
  }
  assert.ok(closeIdx > openIdx, '应能配对出 #taskStateContent 的闭合位置');

  const buildIdx = htmlCode.indexOf('id="buildReport"');
  assert.ok(buildIdx > 0, '应能找到构建验证区块（用稳定的 #buildReport 判定 —— class="panel build-section" 已被改名）');
  assert.ok(buildIdx > closeIdx,
    `★ 构建验证区块必须在 #taskStateContent **外部**（实测 build=${buildIdx}，`
    + `容器闭合于 ${closeIdx}）。放进容器里的话，「当前没有任务」时整块被 hidden 带走 ——`
    + '那就等于把这一页删掉了，而不是降级。构建验证是用户主动动作，不依赖有没有任务。');

  /* 反向也要守：容器里不应再出现第二份构建相关 id（重复 id 的第一个才是活的） */
  const inContainer = htmlCode.slice(openIdx, closeIdx);
  assert.doesNotMatch(inContainer, /id="buildReport"/,
    '#taskStateContent 里不应再有第二份构建报告 —— 重复 id 会让第二份永远不更新');
});

test('the task page stays light when idle, keeps its history panel, and never eats its own text', () => {
  /* 第 30 轮用户原话，一句话里三个独立问题：
   *   「任务状态页面一言难尽，UI过于简陋，历史清除了怎么整个部分都没有了，
   *     还有在不同比例下UI会发生严重形变」
   *
   * 逐条真机实测（第30轮实测/item2-baseline.json → item2-verify.json）：
   *
   * ① 空闲态（规则在第 31 轮被用户推翻，见下面的 ① 节）：
   *    第 30 轮把空态做成 3 张预告卡，第 31 轮用户要求整块删除
   *    （「工具软件不需要在没有任务时平铺说明书」）。
   *    现在改为工具栏上的一个状态胶囊。
   *
   * ② 历史清空后整块消失：改前 applyTaskHistoryVisibility 里是
   *    panel.hidden = !hasItems —— 一条记录都没有时**整块面板消失**，
   *    连带标题、说明、「收起」和「清空历史」一起没了，看起来像功能坏了。
   *    改后：panel 常驻，两个按钮在没有记录时禁用。
   *
   * ③ 窄屏形变：改前 .two-column / .task-grid **从不折单列**，
   *    760px 时每列 226.333px、.build-plan-list 的值列只剩 93px，
   *    而值文案 "未检测到可用测试；不会盲目执行" 需要 195px ——
   *    被 nowrap+ellipsis 静默截成 "未检测到可用…"。
   *    最坏的地方不是难看，是**读不到"不会盲目执行"这个关键结论**，
   *    而省略号在窄列里几乎看不见。860px(143) / 980px(186) 同样不够。
   *    改后：≤900px 折单列；值列表改为可换行，任何宽度都不丢字。
   *    实测 760/860/980/1100/1440 五档全部 0 裁切。
   *
   * ★ 每条断言都对应"把它改坏，上面的读数会怎样"：
   *   · 把三张预告卡加回来 → ① 的 doesNotMatch 红
   *   · 退回 panel.hidden = !hasItems → 常驻断言红
   *   · 把 nowrap+ellipsis 写回去 / 删掉窄屏折行 → 对应断言红
   * 这些不是"文件里出现过某个词"，是形态与结构本身。 */
  const html = read('renderer/index.html');
  const css = read('renderer/styles.css');
  const app = read('renderer/app.js');
  const htmlCode = html.replace(/<!--[\s\S]*?-->/g, '');
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const appCode = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

  /* ── ① 空闲态只留一个状态胶囊，不再平铺说明书卡 ───────────────────
   *
   * ★ 第 31 轮（用户第 2 条）**推翻**了第 30 轮在这里做的东西。
   *   第 30 轮的判据是"空态必须预告将来会出现哪三块"，
   *   于是有了三张预告卡（执行步骤 / 测试与文件 / 构建与验证）。
   *   第 31 轮用户原话：「删除上半部分的大卡片…以及内部强行并排的 3 个
   *   说明卡片…工具软件不需要在没有任务时平铺说明书」。
   *
   *   所以这条断言必须**反向**写：三张预告卡不得复现，容器也不得残留。
   *   这不是"护栏跟着实现漂移"—— 它守的规则变了：
   *     第 30 轮守「空闲态要能自我说明」；
   *     第 31 轮守「空闲态不得占版面，状态说明要轻量」。
   *   两条规则都成立过，只是产品的取舍变了。
   *
   * ★ 为什么整块删除而不是留着用 CSS 隐藏：
   *   留一个 hidden 的容器等于留一个"将来有人把 hidden 去掉就复活"的暗门，
   *   而那 3 张卡的文字还在 HTML 里，仍然会被读屏软件与静态审计看到。
   *   删干净，让"说明书卡片"这个形态不能通过任何开关回来。 */
  assert.doesNotMatch(htmlCode, /id="taskStateEmpty"/,
    '★ 空闲态大卡片容器必须整块删除（第 31 轮用户第 2 条）');
  assert.doesNotMatch(htmlCode, /task-empty-intro/,
    '★ "当前没有进行中的任务" 那句介绍也必须删掉 —— 状态由胶囊表达');
  assert.doesNotMatch(cssCode, /\.task-empty-grid/,
    '★ 三张预告卡的样式必须一同删除，不留死 CSS');

  /* 轻量状态提示：工具栏上的一个胶囊。它必须真的带状态点（i），
   * 不是一个纯文字标签 —— 圆点是"余光可读"的实现。 */
  assert.match(htmlCode, /class="status-pill[^"]*" id="taskIdleChip"/,
    '★ 空闲态应改为工具栏上的状态胶囊（用户第 2 条：「改用轻量级状态提示」）');
  assert.match(cssCode, /\.status-pill i\{/,
    '★ 状态胶囊要有圆点标记 —— 纯文字标签在余光里读不出"就绪"这个状态');
  assert.match(appCode, /if \(idleChip\) \{\s*\n\s*idleChip\.hidden = hasTask;/,
    '★ 有任务时胶囊必须让位给真实的进度视图，不能同时显示两种状态');

  /* 空闲态不得放任何"去创建任务"类按钮 —— 这一页没有创建任务的入口。
   * （「清除任务状态」是页头工具，不在此列；它的显隐由 ④ 守。） */
  const idleChipTag = htmlCode.match(/<span class="status-pill" id="taskIdleChip"[\s\S]{0,200}?<\/span>\s*<\/span>/)?.[0] || '';
  assert.doesNotMatch(idleChipTag, /<button/,
    '★ 空闲胶囊里不应放按钮');

  /* ── ② 历史面板必须常驻，不许"空了就整块消失" ─────────────────────── */
  assert.match(appCode, /panel\.hidden = false;/,
    '★ 历史面板必须常驻 —— 数据空了就整块消失，用户会以为功能坏了');
  assert.doesNotMatch(appCode, /panel\.hidden = !hasItems/,
    '★ 不得退回"没有记录就整块隐藏"（第 2 条抱怨的正是这个）');
  /* 两个动作按钮在没有记录时都得禁用，否则"点了没反应" */
  assert.match(appCode, /button\.disabled = !hasItems;/,
    '★ 「收起」在没有记录时应禁用');
  assert.match(appCode, /if \(clear\) clear\.disabled = !hasItems;/,
    '★ 「清空历史」在没有记录时应禁用');
  /* 空态文案必须"描述状态 + 交代后续"，而且**只能有一份**：
   *   页面刚打开时并没有"清空"过，写"已清空"会让第一次用的人以为数据被清了；
   *   同时必须说明"以后还会有记录进来" —— 那正是用户困惑的下一句。
   *
   * ★ 第 41 轮重锚：原判据把第 30 轮那份逐字文案钉死了
   *   （「还没有历史记录。任务结束或中断后会自动归档到这里。」），
   *   而后来界面重写时这句被换成了「…将在此归档呈现。」——
   *   措辞变了，要守的性质没变。更要紧的是当时暴露出一个**真缺陷**：
   *   常量定义了却没人用（渲染函数里另写了一份字面量），
   *   于是"一处定义"只是注释里的一句话，实际仍是两份文案。
   *   所以判据改成查**结构**：常量真的被引用 + 标记首帧与运行期逐字相同。 */
  const emptyText = appCode.match(/const HISTORY_EMPTY_TEXT = '([^']+)';/)?.[1] || '';
  assert.ok(emptyText, '空态说明必须抽成常量（首次读取 / 删完变空共用一句）');
  assert.doesNotMatch(emptyText, /已清空|已删除/,
    '★ 空态文案描述的是状态，不是动作 —— 页面刚打开时并没有"清空"过，'
    + '写"已清空"会让第一次用的人以为数据被清了');
  assert.match(emptyText, /归档/,
    '★ 空态说明必须交代"以后还会有记录归档进来" —— 这正是用户困惑的下一句');
  assert.match(appCode, /task-clean-empty-desc">\$\{HISTORY_EMPTY_TEXT\}<\/p>/,
    '★ 空态渲染器必须直接引用常量 —— 渲染处另写一份字面量，'
    + '那段常量就是"定义了没人用"的死代码，两条路径会各说各话');
  /* 初始标记里那份占位也要是同一句，否则首帧会闪一下旧文案 */
  assert.ok(htmlCode.includes(emptyText),
    '初始标记的历史占位应与运行期文案逐字一致（否则首帧会闪一下旧文案）');
  assert.doesNotMatch(htmlCode, /id="taskHistoryPanel"[^>]*\shidden/,
    '★ #taskHistoryPanel 不应在标记里带 hidden —— 面板常驻，显隐由 JS 统一管');

  /* ── ③ 值列表不再静默吃字 ───────────────────────────────────────── */
  /* 同上：不锚行首 —— 这条规则也在压缩行里。
   *
   * ★ 本项目第 14 次教训（现在写在这里，不再等被搞红）：
   *   styles.css 里大量规则被压缩在同一行，`^\.selector\{` 会 **0 匹配**。
   *   而断言写的是 assert.equal(rules.length, 1) ——
   *   于是"根本没找到"报出来的是「应只有一处定义（实得 0）」，
   *   看起来像"规则重复"，实际是完全相反的事。
   *   所以左边界必须是 `(?:^|[;}])`，不能锚行首。 */
  const g = (sel) => [...cssCode.matchAll(new RegExp(`(?:^|[;}])\\s*${sel.replace('.', '\\.')}\\{([^}]*)\\}`, 'g'))].map((m) => m[1]);
  const strongRules = g('.build-plan-list strong');
  assert.equal(strongRules.length, 1, `.build-plan-list strong 应只有一处定义（实得 ${strongRules.length}）`);
  assert.doesNotMatch(strongRules[0], /white-space:\s*nowrap/,
    '★ 值列不得再用 nowrap —— 它配合窄列会把"未检测到可用测试；不会盲目执行"'
    + '截成"未检测到可用…"，用户读不到关键结论');
  assert.doesNotMatch(strongRules[0], /text-overflow:\s*ellipsis/,
    '★ 值列不得再用 ellipsis —— 静默截断且看不出被截');
  assert.match(strongRules[0], /overflow-wrap:\s*anywhere/,
    '★ 值列要允许在任意位置断行，任何宽度都读得全');

  /* ── ④ 窄屏必须折单列 ───────────────────────────────────────────── */
  /* 提取 max-width 断点的内容。★ 不能用 /@media\(...\)\{([\s\S]*?)\n\}/ 这类
   * "找换行 + 右括号"的写法：媒体块里最后一条规则可能和 } 写在同一行，
   * 也可能整块被压缩。用括号配对（与 mediaBlocks 同一套逻辑）才可靠。 */
  const mediaBlocks = (s) => {
    const out = [];
    let rest = s;
    for (;;) {
      const i = rest.indexOf('@media');
      if (i < 0) return out;
      const head = rest.slice(i).match(/^@media\(([^)]*)\)\{/);
      if (!head) return out;
      let depth = 0; let j = i + head[0].length - 1; const start = j + 1;
      for (; j < rest.length; j += 1) {
        if (rest[j] === '{') depth += 1;
        else if (rest[j] === '}') { depth -= 1; if (depth === 0) break; }
      }
      out.push({ query: head[1], body: rest.slice(start, j) });
      rest = rest.slice(j + 1);
    }
  };
  const blocks = mediaBlocks(cssCode);
  /* ★ 900px 断点在本文件里**有两个**（另一个是 .performance-metrics 的性能指标
   *   折行，属紧凑层）。所以不能用 find 取第一个 —— 那样会对着
   *   `.performance-metrics{...}` 断言 .two-column，报出一条完全误导的失败。
   *   要按"哪个块里真的有这条规则"来选。 */
  const fold = blocks.find((b) => /max-width:\s*900px/.test(b.query) && /\.two-column\{/.test(b.body));
  assert.ok(fold,
    '应存在 max-width:900px 断点且里面有 .two-column 折行（860px 下两列仍读不全，只写 760 太晚）');
  /* 同块内两条都要在：两列区、任务栅格。 */
  for (const sel of ['.two-column', '.task-grid']) {
    assert.match(fold.body, new RegExp(`\\${sel}\\{grid-template-columns:minmax\\(0,1fr\\)\\}`),
      `★ ${sel} 必须在同一个 ≤900px 块里折成单列 —— 否则窄屏时列被挤到读不全文本`);
  }
  /* 断点不能只写到 760：860px 时 .two-column 每列 276px、值列 143px，
   * 依然不够那句 195px 的关键文案。 */
  assert.ok(blocks.some((b) => /max-width:\s*900px/.test(b.query) && /\.two-column\{/.test(b.body)),
    '★ .two-column 的折行断点必须 ≥900px —— 只写 760 会漏掉 860px 那一档');
});

test('the project-context panel is a one-line reading strip, not three stacked cards', () => {
  /* 第 23 项：用户第 5 条前半「项目指令与上下文有什么用？还占用大量面积」。
   *
   * 实测判据（1360×900，工作区与权限页）：
   *   改前 面板 299px = 标题 44 + 状态列表 183（3 行 × 56 + 2 × 7 gap）
   *                    + 指令明细 17 + padding 36
   *        工作区页可滚动总高 909px —— 这一块占掉约三分之一。
   *   改后 面板 157px、总高 767px。
   *
   * 这条测试要守的是"别再退回成三张卡片"，同时保证**信息一个都没丢**：
   * 三格读数、明细折叠块、刷新入口都必须还在。
   * 只断言"用了 .context-strip"是不够的 —— 把内容删空也能通过。 */
  const html = read('renderer/index.html');
  const css = read('renderer/styles.css');
  const app = read('renderer/app.js');
  const htmlCode = html.replace(/<!--[\s\S]*?-->/g, '');
  /* ★ 剥注释再断言 —— 这是本项目栽过 8 次的老坑。
   * app.js 第 23 项的改动注释里逐字写着
   *     「原来这里渲染一行「当前项目没有 AGENTS.md / CLAUDE.md…」」
   * —— 那是**解释为什么删掉它**的文档，不是代码。
   * 不剥注释的话，下面那句 doesNotMatch 会命中自己的说明文档，
   * 于是正确的改动被自己的注释搞红。（也要剥 // 行注释，同理。） */
  const stripComments = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  const appCode = stripComments(app);

  // ① 面板存在，且用一行读数条而不是 environment-list 卡片列
  const panel = htmlCode.match(/<article class="panel project-instructions-panel">([\s\S]*?)<\/article>/);
  assert.ok(panel, '应能截出项目指令与上下文面板');
  assert.match(panel[1], /<div class="context-strip">/,
    '★ 三格读数必须收进 .context-strip（一行条），不能再是 .environment-list（一列卡片）');
  assert.doesNotMatch(panel[1], /environment-list/,
    '★ 这一块不应再用 .environment-list —— 它每行 min-height 52px，'
    + '三行就是 183px，正是用户说的"占用大量面积"');

  // ② 三格信息一个都不能丢（压缩不能变成删除）
  for (const id of ['projectInstructionsDot', 'projectEntrypointDot', 'contextPressureDot',
    'projectInstructionsStatus', 'projectEntrypointStatus', 'contextPressureStatus']) {
    assert.match(panel[1], new RegExp(`id="${id}"`), `${id} 是这一块的核心读数，压缩时必须保留`);
  }

  // ③ 指令文件明细仍在，且默认 hidden（空态不占位）
  assert.match(panel[1], /id="projectInstructionsList"[^>]*\shidden/,
    '★ 指令明细初始必须 hidden —— 没有指令文件时那 17px + 15px 间距是纯占位');
  assert.match(panel[1], /id="refreshWorkspaceContext"/, '刷新入口必须保留');

  /* ④ 明细块的显隐必须由数据驱动（只写静态 hidden 会让有文件时也不显示）。
   * 注意 excludeAttribute 那类"只改 HTML 属性"的改坏方式挡不住 ——
   * 所以这里断言 JS 里那两处赋值本身。 */
  assert.match(app, /list\.hidden = items\.length === 0;/,
    '★ 指令明细要按有没有文件来显隐');
  assert.match(app, /if \(list\) \{ list\.replaceChildren\(\); list\.hidden = true; \}/,
    '★ 读取失败时明细也要收起 —— 否则会留着上次成功读取的内容，与"暂不可读"自相矛盾');

  // ⑤ CSS 契约
  assert.match(css, /\.context-strip\{[\s\S]{0,400}?grid-template-columns: repeat\(auto-fit, minmax\(200px, 1fr\)\)/,
    '读数条应宽屏一行、窄屏自动折行（不写媒体查询）');
  assert.match(css, /\.instruction-list\[hidden\]\{ display: none; \}/,
    '★ 必须显式声明 [hidden] —— .instruction-list 带 margin-top，'
    + '而 .task-files 是 display:grid，会盖过 UA 的 [hidden]{display:none}');

  /* ⑥ 空态明细行已删除 —— 移到下面 "speaks human" 那条测试里。
   * 这里原本还断言了「未使用（将走内置工作流规则）」，但那是**文案**判断，
   * 归到"读数条说的是不是人话"那条测试更合适（负向验证发现归属弄错会让
   * 变异跑错测试名 → 误判成"护栏失效"）。
   * 本测试只管结构与面积：一行条 vs 三张卡片、明细的显隐契约。 */
});

test('the context strip speaks human, never leaking internal enum values or doubled words', () => {
  /* 第 23 项实测抓到的文案 BUG：第一版把回退写成
   *     `${projectTypeLabel(project.type)}项目`
   * 而 projectTypeLabel() 的返回值**本身就带**"项目"
   * （'未知项目' / 'Node.js 项目' / '.NET 项目'），
   * 于是页面真的渲染出「未知项目项目」。
   *
   * 这类"拼接重复"静态测试查不出来（正则里只有代码，没有渲染结果），
   * 是真机读到 DOM 文本才发现的。所以这里两头都守：
   *   ① 源码里不得再出现"…Label(...)}项目"这种自拼；
   *   ② 把 projectTypeLabel 抠出来在沙箱里真跑，确认它的每个返回值
   *      对"再拼一次项目"是敏感的 —— 也就是说这个坑会被再次踩到。 */
  const app = read('renderer/app.js');
  /* ★ 剥注释 —— 本测试的说明文档自己就逐字写着那个错误写法
   * （app.js 行 721 也写着），不剥的话会命中自己。
   * 这是本项目第 8 次栽在同一个坑上，所以这里把"剥注释"放在
   * 断言之前第一行，而不是等被搞红再补。 */
  const appCode = app
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

  assert.doesNotMatch(appCode, /\$\{projectTypeLabel\([^)]*\)\}项目/,
    '★ 不要自己拼"项目"二字 —— projectTypeLabel 的返回值已经带了');
  assert.doesNotMatch(appCode, /'unknown'\} 项目/,
    '★ 不要把内部枚举值 unknown 直接摆给用户看');

  const vm = require('node:vm');
  const fnBody = app.match(/function projectTypeLabel\(value\) \{([\s\S]*?)\n\}/);
  assert.ok(fnBody, '应能找到 projectTypeLabel');
  const helper = app.match(/function textOr\(value, fallback = '—'\) \{([\s\S]*?)\n\}/);
  assert.ok(helper, '应能找到 textOr（projectTypeLabel 依赖它）');
  const label = vm.runInNewContext(
    `(function(){ const textOr = function(value, fallback = '—'){${helper[1]}}; return function(value){${fnBody[1]}}; })()`);

  // 每个已知类型都应带"项目"或本身就是完整说法 —— 这是"不能自拼"的证据
  const labels = ['electron', 'node', 'python', 'rust', 'go', 'maven', 'dotnet', 'unknown']
    .map((type) => label(type));
  assert.ok(labels.every((text) => text && text.length > 1), `所有类型都应有可读文案：${labels.join('/')}`);
  assert.equal(label('unknown'), '未知项目');
  assert.equal(label('node'), 'Node.js 项目');
  assert.ok(labels.filter((text) => text.endsWith('项目')).length >= 6,
    `多数返回值以"项目"结尾 —— 所以外面绝不能再拼一次。实测：${labels.join(' / ')}`);

  // 未知类型也不能露出裸枚举值
  assert.ok(!label('some-unknown-type').includes('undefined'), '未知类型不应露出 undefined');
  assert.equal(label('some-unknown-type'), 'some-unknown-type',
    '未登记的类型原样透出（它是项目自己声明的，比"未知"更有信息量）');

  /* 上下文压力：三项全 0 时不该摆一串零。
   * "0 次工具调用 · 0 个文件 · 0 MB 输出" 是一句没有信息量的读数 ——
   * 用户看到只会想"那我到底用没用过"。 */
  assert.match(appCode, /本次会话尚未开始/, '三项全 0 时应说"本次会话尚未开始"');
  assert.match(appCode, /const idle = !toolCalls && !filesRead && !megabytes;/,
    '★ 空闲判据必须三项同时为 0 —— 只看其中一项会把"读过文件但没调工具"误判成空闲');

  /* 指令文件的空态：两件事要一起说 —— ① 明细行别再说第二遍"没有"
   * （原来说"当前项目没有 AGENTS.md / CLAUDE.md…"，与读数格重复）；
   * ② 读数格本身要说清"没有指令文件时会发生什么"，
   * 只写"未检测到 AGENTS.md / CLAUDE.md"等于只说没有、不说后果，
   * 用户不知道该担心还是不用管。 */
  assert.doesNotMatch(appCode, /当前项目没有 AGENTS\.md/, '空态明细行已删除（那句话与读数格重复）');
  assert.match(appCode, /: '未使用（将走内置工作流规则）';/,
    '★ 读数格要自己说清"没有指令文件时会发生什么"，而不是只说"未检测到"');
});