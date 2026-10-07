const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

/* ============================================================================
 * 第 31 轮：任务执行状态 / 构建与验证 页面重构
 * ----------------------------------------------------------------------------
 * 用户 5 条要求里，3 条是**形态约束**，静态检查守得住：
 *   ① 字体渲染 Bug（字体栈 + 负字距 + 行高）
 *   ③ 控制台不再是"巨大空洞框"
 *   ④ 按钮主次与破坏性按钮的条件显隐
 * ⑤ 文案瘦身。
 * ② 删空态卡片由 chat-ui-compact.test.js 的
 *   "the task page stays light when idle…" 反向守（那条测试在第 31 轮被改写）。
 *
 * ★ 为什么字体那两条必须自建测试、不能靠 stylelint：
 *   stylelint.config.mjs 全文**没有** letter-spacing 规则，也没有
 *   font-family 规则。字体是"看起来只是风格"的一类样式，但本轮的故障
 *   （文字挤压、字符重叠错位、笔画变形）正是它造成的 ——
 *   没有护栏的一类样式，就会长期无人看守。
 * ========================================================================== */
test('the round-31 task page repairs its type rendering, drops the fake console box, and ranks its buttons', () => {
  const css = read('renderer/styles.css');
  const browserCss = read('renderer/browser.css');
  const tokens = read('renderer/design-tokens.css');
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  /* ★ 剥注释（本项目已栽 14 次的坑）：下面多处 doesNotMatch 的目标写法，
   *   在源码注释里被逐字引用作为"改前长什么样"的说明。
   *   注释无法与代码区分 —— 这是正则的天性，所以必须显式剥掉。 */
  const htmlCode = html.replace(/<!--[\s\S]*?-->/g, '');
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const browserCode = browserCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const tokensCode = tokens.replace(/\/\*[\s\S]*?\*\//g, '');
  const appCode = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

  /* ══ ① 字体栈：两个表面必须逐字一致，且含 system-ui 与中文字体 ═══════
   * ★ 这不是"风格统一"，是渲染正确性：
   *   改前 styles.css 是 "Segoe UI Variable","Microsoft YaHei UI",sans-serif，
   *   browser.css 是 Inter,"Segoe UI","Microsoft YaHei UI",sans-serif ——
   *   **两套**。同一个应用的两个视图用了不同的中文回退链，
   *   来回切换时字面宽度会变（观感上"字在跳"），
   *   而用户在任一个视图里都看不到另一半的存在。
   *
   * ★ 为什么要逐字对齐（而不是"两边都含 system-ui 就行"）：
   *   回退链是**有序**的。两边都含 system-ui 但后面顺序不同，
   *   在缺前面几个字体的机器上仍会落到不同的中文字体 ——
   *   仍是同一类 bug，只是更难遇到、更难查。 */
  const normalizedStack = (value) => String(value).replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').trim();
  const tokenStack = normalizedStack(tokensCode.match(/--font-sans:\s*([^;]+);/)?.[1]);
  assert.ok(tokenStack, 'design-tokens.css 应声明 --font-sans');
  for (const family of ['system-ui', '-apple-system', '"PingFang SC"', '"Microsoft YaHei"']) {
    assert.ok(tokenStack.includes(family),
      `★ --font-sans 必须显式包含 ${family} —— 缺它时中文只能等平台的隐式回退，`
      + '而回退结果（字面宽度）与西文不匹配，表现即用户报的"文字挤压、笔画变形"');
  }
  /* styles.css 必须通过令牌消费，不得再写自己的字面量栈 */
  assert.match(cssCode, /body\{ font-family: var\(--font-sans\);/,
    '★ styles.css 的 body 字体必须走 --font-sans 令牌 —— 写字面量栈会让"唯一来源"重新分叉');
  assert.doesNotMatch(cssCode, /font-family:\s*"Segoe UI Variable"/,
    '★ styles.css 不得再内联旧的字体栈字面量');
  /* browser.css 不加载令牌文件，只能写字面量 —— 但必须与令牌**逐字一致**。
   * ★ 比较前归一化逗号后的空格：CSS 里 `a, b` 与 `a,b` 完全等价，
   *   把空格差当成"不一致"会报出一条看不出问题的失败。 */
  const browserStack = normalizedStack(browserCode.match(/:root\{color-scheme:light;font-family:([^;]+);/)?.[1]);
  assert.ok(browserStack, 'browser.css 的 :root 应声明 font-family');
  assert.equal(browserStack, tokenStack,
    '★ 两套表面的字体栈必须逐字一致 —— 回退链是有序的，"都含 system-ui"不够，'
    + '顺序不同仍会在缺字体的机器上落到不同中文族');

  /* ══ ①b 负字距：中文挤压重叠的直接成因，全站不得再有 ═════════════════
   * stylelint 没有 letter-spacing 规则，所以这一条只能靠测试守。
   * 这正是它必须存在的原因。 */
  const negativeTracking = [...cssCode.matchAll(/letter-spacing:\s*(-[\d.]+)px/g)].map((m) => m[1]);
  assert.deepEqual(negativeTracking, [],
    '★ 不得使用负 letter-spacing —— 中文字面比西文宽，负字距先让笔画重叠，'
    + `实测即用户报的"文字挤压、字符重叠错位"。仍发现：${negativeTracking.join(', ')}`);
  assert.doesNotMatch(browserCode, /letter-spacing:\s*-[\d.]+px/,
    '★ browser.css 同样不得有负字距');

  /* 中文正文行高下限：低于 1.35 时换行处上下两行的笔画会相碰。
   *
   * ★ 为什么必须按**选择器**过滤，而不是扫全文件的数值：
   *   同一个 1.2 在不同元素上含义完全不同 ——
   *     .health-summary-card b{line-height:1.2}   一个"20 或 0"的计数，单行
   *     .panel-title p{line-height:1.55}          会换行的说明文字
   *   按数值一刀切会在正确的代码上报红，而报错的护栏等于没有护栏。
   *   所以只查 **承载句子的元素**（p / h1-h6 / small / li / label），
   *   这些是会换行的；纯图标与定高数字卡（b / i / span 在特定容器里）不查。 */
  const TEXT_ELEMENT = /(?:^|[\s,>])(?:p|h[1-6]|small|li|label|body)(?:[\s,:{]|$)/;
  const tightLineHeights = [...cssCode.matchAll(/([^{};\n]+)\{([^}]*)\}/g)]
    .filter((m) => TEXT_ELEMENT.test(m[1]))
    .map((m) => ({ sel: m[1].trim().split(/\s+/).pop(), lh: m[2].match(/line-height:\s*(1\.[\d]+)/)?.[1] }))
    .filter((r) => r.lh !== undefined && Number(r.lh) > 1 && Number(r.lh) < 1.35);
  assert.deepEqual(tightLineHeights, [],
    '★ 会换行的正文元素行高不得低于 1.35（中文双行会挤在一起）。'
    + `实测偏紧：${tightLineHeights.map((r) => `${r.sel}=${r.lh}`).join(', ')}`);

  /* ══ ③ 控制台：不得有固定大高度 + 不得用低对比字面量 ═════════════════ */
  const consoleRule = [...cssCode.matchAll(/(?:^|[;}])\s*\.build-console\{([^}]*)\}/g)].map((m) => m[1]);
  assert.equal(consoleRule.length, 1, `.build-console 应只有一处定义（实得 ${consoleRule.length}）`);
  /* ★ 正则必须排除 min-height / max-height：`height:\d+px` 在
   * "min-height:66px" 里是**子串**，不加左边界会把正当写法当成固定高度。 */
  assert.doesNotMatch(consoleRule[0], /(?:^|[;\s])height:\s*\d+px/,
    '★ 控制台不得再用固定 height（改前 310px 就是"巨大空洞框"的实体）—— '
    + '它必须在内容少时收缩、内容多时生长');
  assert.match(consoleRule[0], /min-height:\s*\d+px/, '★ 控制台应有 min-height 保证至少显示出提示符');
  assert.match(consoleRule[0], /max-height:\s*\d+px/, '★ 控制台应有 max-height 防止日志把整页撑爆');
  /* 颜色必须走令牌：改前是 #080b10 / #c9d2df / #344052 / #f4f7fb 四个字面量，
   * 它们正是"几乎不可见的浅灰占位字"的取值来源，且没有任何护栏管它们。 */
  assert.match(consoleRule[0], /color:var\(--console-text\)/, '★ 控制台文字色应走 --console-text 令牌');
  assert.match(consoleRule[0], /background:var\(--console-bg\)/, '★ 控制台底色应走 --console-bg 令牌');
  assert.match(consoleRule[0], /font:var\(--fs-pre\)\/[\d.]+ var\(--font-mono\)/,
    '★ 控制台字体应走 --font-mono 令牌（与全局字体栈同一处声明）');
  /* 初始内容必须是终端提示符，不是一句叙述 */
  assert.match(htmlCode, /<pre class="build-console" id="buildConsole"><span class="console-prompt">\$<\/span>/,
    '★ 控制台初始内容应是标准终端提示符（$ + 下一步动作），不是"尚未执行…"这类叙述句');
  assert.match(cssCode, /\.console-prompt\{/, '★ 提示符应有自己的颜色（与正文日志区分）');
  /* 追加输出时必须先清掉提示符 —— 用结构判据而不是比对那句文案 */
  assert.match(appCode, /const hasPrompt = consoleElement\.querySelector\('\.console-prompt'\);/,
    '★ appendBuildOutput 应以"提示符节点是否还在"判断要不要清空 —— '
    + '比对具体文案的话，换个提示符文案就会让第一行日志与提示符拼在一起');

  /* ══ ④ 按钮主次：构建验证区块里唯一的 Primary 是「开始验证」 ═════════
   * ★ 第 41 轮重锚：原切片从**全文件第一个** `class="settings-section"` 起算，
   *   而构建区块已搬到偏好设置页的第 4 张 advanced-card-block ——
   *   那个起点在运行与连接页，于是切片沿途把所有页面的主按钮都捞了进来
   *   （实得 copyTestPromptBtn / copyCustomInstructions / repairHealth / saveRuntimeKey），
   *   报出的是"主操作不止一个"这种与技术事实不符的结论。
   *   新切片锚在构建区块自己身上：从容纳 #buildProjectType 的那张卡片起，
   *   到它所在的高级设置区结束。 */
  const buildTypeIdx = htmlCode.indexOf('id="buildProjectType"');
  assert.ok(buildTypeIdx > 0, '应能找到构建区块的 #buildProjectType（构建与验证区块的锚点）');
  const buildCardStart = htmlCode.lastIndexOf('<div class="advanced-card-block">', buildTypeIdx);
  assert.ok(buildCardStart >= 0, '构建区块应落在一个 advanced-card-block 里');
  const buildSectionEnd = htmlCode.indexOf('</section>', buildTypeIdx);
  const buildSectionMatch = [htmlCode.slice(buildCardStart, buildSectionEnd)];
  assert.ok(buildSectionMatch[0].includes('id="runBuild"'), '应能截出构建与验证区块正文');
  const primaryButtons = [...buildSectionMatch[0].matchAll(/class="primary-button[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(primaryButtons, ['runBuild'],
    '★ 构建验证的主操作只能有一个（「开始验证」）。改前「重新识别项目」也是实底按钮，'
    + `两个同权重并排 → 用户看不出哪个是主动作。实得：${JSON.stringify(primaryButtons)}`);
  assert.match(buildSectionMatch[0], /class="secondary-button[^"]*" id="inspectBuild"/,
    '★ 「重新识别项目」必须降为次级样式');

  /* 破坏性按钮：无任务时不得出现。
   * ★ 这里**不能**用 `/<button class="danger-button" id="clearTaskState" hidden>/`
   *   这种逐字匹配 —— 它太脆，多挂一个 `style="display:none"` 或调一下
   *   属性顺序就会假红，而那两件事都不改变"按钮默认不可见"这个性质。
   *   （这条是负向验证的**对照实验④d 逼出来的**：语义等价的改写把护栏搞红了，
   *     报出的却是"破坏键常驻"—— 一条与技术事实不符的错误结论。）
   *   改成按**属性语义**断言：它必须是 danger-button、必须带 hidden。 */
  const clearStateTag = htmlCode.match(/<button[^>]*id="clearTaskState"[^>]*>/)?.[0] || '';
  assert.ok(clearStateTag, '任务页应有「清除任务状态」按钮');
  assert.match(clearStateTag, /class="danger-button"/,
    '★ 「清除任务状态」应保持危险动作的视觉身份');
  assert.match(clearStateTag, /\shidden(?=[\s>])/,
    '★ 「清除任务状态」必须默认 hidden —— 空闲时把红色破坏性按钮摆在最显眼处，'
    + '会让整页看起来像"有个危险操作待确认"');
  /* ★ 允许 `if (clearState) {` 的块写法：这条判据守的是"显隐由 hasTask 决定"，
   *   不是"必须写成单行"。块里额外补的那句 display 覆盖是为了盖过
   *   开发者分组容器的 display 规则，不改变这个结论。 */
  assert.match(appCode, /if \(clearState\)\s*\{?\s*clearState\.hidden = !hasTask;/,
    '★ 它的显隐必须由 hasTask 决定（有任务才有可清的状态）');

  /* 次级入口「历史运行记录」必须真的存在且能跳到历史面板 */
  assert.match(htmlCode, /class="secondary-button" id="jumpTaskHistory"/,
    '★ 应提供查看「历史运行记录」的次级入口（用户第 4 条）');
  assert.match(appCode, /if \(taskHistoryCollapsed\(\)\) setTaskHistoryCollapsed\(false\);/,
    '★ 跳转前必须先展开历史面板 —— 收起状态下滚过去只能看到一条标题条，'
    + '而用户的意图是"看记录"');

  /* ══ ⑤ 文案瘦身：标题下的长句说明不得复现为**可见正文** ═══════════════
   * ★ 关键区分：用户第 5 条要求的是"删掉冗长文案，改用图标悬浮提示"。
   *   所以这些句子**允许出现在 title 属性里**（那正是要求的一部分），
   *   只禁止它们作为页面上的可见文字。
   *   不区分的话，这条断言会与用户的要求正好相反 —— 它会把
   *   "把长句挪进 tooltip"这个正确动作判成失败。 */
  const visibleHtml = htmlCode
    .replace(/\stitle="[^"]*"/g, '')
    .replace(/\splaceholder="[^"]*"/g, '')
    .replace(/\saria-label="[^"]*"/g, '');
  const longCopy = [
    '让助手自己识别项目类型并选好测试与构建命令',
    '点一次「开始验证」就会依次跑测试、跑构建、检查产物',
    '状态保存在当前工作区，刷新网页、切换聊天或本地工具重启后仍可继续。',
    '完成验证后显示测试、构建、版本、产物和 SHA256。',
    '已结束或已中断的任务会归档到这里，最多保留 100 条'
  ];
  for (const sentence of longCopy) {
    assert.ok(!visibleHtml.includes(sentence),
      `★ 冗长说明文案不得再作为可见正文出现（应挪进 title 悬浮提示）：${sentence}`);
  }
  /* 说明必须真的挂在**构建区块自己**身上（删了文案但没补回说明 = 信息直接丢失）。
   * ★ 这里必须**限定作用域**：全页扫描时，页面别处的说明能替构建区块"顶班"——
   *   于是把构建区块的说明删掉测试仍然绿，而受损信息恰恰是**构建区块**的。
   *   （这条也是负向验证的 ⑤b 逼出来的：删掉构建区块的说明，护栏 SURVIVED。
   *     全页范围的断言会互相遮蔽，必须收窄到被测的那个区块。）
   *
   * ★ 第 41 轮重锚：原判据要求构建区块里有一个 `?` 悬浮提示
   *   （class="field-tip" title="…"，切片锚在 `<h3>构建与验证</h3>` 上）。
   *   后续界面重写把这页改成"卡片 + 行"结构：
   *     · 标题从 h3 变成每张卡片自己的 h4（项目识别与方案 / 构建与测试策略 / 验证控制台）；
   *     · 说明从"藏在 ? 里"改成**逐行常显**的 .advanced-row-desc ——
   *       这比悬停更好（不用鼠标就能读到），所以不是信息缩水，是换了呈现。
   *   判据跟着"信息必须还在"这个意图走，锚点换成新结构：
   *   构建区块里**每个可配置项**都必须带一句不短于 10 字的说明，
   *   并且"每行都有"这件事本身就是判据（只查一处，删掉另外四处仍会绿）。 */
  const panelStartIdx = htmlCode.indexOf('id="buildProjectType"');
  const buildWrapIdx = htmlCode.indexOf('id="buildReportWrap"');
  assert.ok(panelStartIdx > 0 && buildWrapIdx > panelStartIdx,
    '应能截出「构建与验证」面板的标记');
  const buildPanel = htmlCode.slice(panelStartIdx, buildWrapIdx);
  const rowDescs = [...buildPanel.matchAll(/class="advanced-row-desc">([^<]+)</g)]
    .map((m) => m[1].trim());
  assert.equal(rowDescs.length, 5,
    '★ 构建区块有 5 个可配置项（跑测试 / 跑构建 / 测试命令 / 构建命令 / 产物目录），'
    + `每一项都要有一句常显说明 —— 实得 ${rowDescs.length} 条：${JSON.stringify(rowDescs)}`);
  for (const desc of rowDescs) {
    assert.ok(desc.length >= 10,
      `★ 说明不得缩水成空占位（原 ? 里的长说明要搬过来，不能只留一句"自定义"）：`
      + `「${desc}」只有 ${desc.length} 字`);
  }
  assert.match(cssCode, /\.advanced-row-desc\s*\{/,
    '★ .advanced-row-desc 样式必须存在（说明行不能是裸文本）');

  /* 构建报告：空态整块隐藏，而不是留一行"完成验证后…"的占位。
   * ★ 按**属性语义**断言（与本文件 ④ 里 clearTaskState 同一条教训）：
   *   `/<div id="buildReportWrap" hidden>/` 这种逐字匹配太脆 ——
   *   多挂一个 style、或调一下属性顺序，就会报出"没有隐藏"这种与技术事实不符的结论。 */
  const wrapTag = htmlCode.match(/<div[^>]*id="buildReportWrap"[^>]*>/)?.[0] || '';
  assert.ok(wrapTag, '任务页应有构建报告容器 #buildReportWrap');
  assert.match(wrapTag, /\shidden(?=[\s>])/,
    '★ 构建报告没有内容时整块隐藏（空占位说明属于用户第 5 条要删的"说教文案"）');
  assert.match(appCode, /if \(wrap\) wrap\.hidden = true;/,
    '★ 空报告必须重新隐藏 wrap —— 否则上一次结果会一直挂在页面上');
  assert.match(appCode, /if \(wrap\) wrap\.hidden = false;/,
    '★ 有报告时必须打开 wrap（只写隐藏不写显示会让报告永远看不见）');

  /* ══ ⑤b 构建报告里的长文本不得静默截断 ═══════════════════════════════
   * ★ 这一条是**负向验证逼出来**的，不是"顺手多写一条"。
   *   本轮把 .build-report-* 从第 28 轮的压缩行里搬出来时，顺手去掉了
   *   2 处 white-space:nowrap + text-overflow:ellipsis（产物路径和 SHA256
   *   在窄列里会被截成 "C:\\…\\app.asar" 这种读不出信息的样子）。
   *   但当时的护栏只覆盖 .build-plan-list strong —— 那是第 30 轮留下的，
   *   搬出来的这两条**没人守**。
   *   负向验证把 nowrap 注回去，全量测试全绿 → 缺口被变异找出来了，
   *   所以补在这里。（护栏不是想出来的，是被攻击出来的。） */
  const ruleOf = (sel) => [...cssCode.matchAll(
    new RegExp('(?:^|[;}])\\s*' + sel.replace(/\./g, '\\.') + '\\{([^}]*)\\}', 'g')
  )].map((m) => m[1]);
  for (const sel of ['.build-report-artifact b', '.build-report-artifact code']) {
    const rules = ruleOf(sel);
    assert.equal(rules.length, 1, `${sel} 应只有一处定义（实得 ${rules.length}）`);
    assert.doesNotMatch(rules[0], /white-space:\s*nowrap/,
      `★ ${sel} 不得用 nowrap —— 产物路径与 SHA256 会被静默截断成读不出信息的样子`);
    assert.doesNotMatch(rules[0], /text-overflow:\s*ellipsis/, `★ ${sel} 不得用 ellipsis`);
    assert.match(rules[0], /overflow-wrap:\s*anywhere/,
      `★ ${sel} 要允许在任意位置断行（路径没有空格，只有 anywhere 能断）`);
  }

  /* ══ ③b 未识别项目的琥珀色标签与快捷配置入口 ═════════════════════════ */
  assert.match(cssCode, /\.build-type-badge\.unknown\{color:var\(--yellow\)/,
    '★ 「未识别项目类型」必须用琥珀色（--yellow）而不是与已识别同款的蓝 —— '
    + '后者让"这一页还没准备好"看不出来');
  assert.match(appCode, /badge\.classList\.toggle\('unknown', unknown\);/,
    '★ 徽标的颜色状态必须由项目类型驱动（写死 unknown 类会让识别成功后仍是琥珀色）');
  /* `project?.testCommand` 与 `project.testCommand` 等价（前者在 project 为空时更稳），
   * 判据守的是"显隐由数据决定"，不比对可选链写法。 */
  assert.match(appCode, /setBuildPlanAction\('configureTestScript', Boolean\(project\??\.testCommand\)\);/,
    '★ 快捷配置入口的显隐必须由**数据**决定（有无 testCommand），不能靠嗅探值文案 —— '
    + '文案会改，数据事实不会');
});