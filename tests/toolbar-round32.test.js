const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

/* 剥注释。★ 本项目已在"注释里引用了要被删掉的写法"上栽过 14 次，
 * 每一轮都要重申一次：断言"某种写法必须消失"之前，先把注释剥干净，
 * 否则那条**解释为什么删掉它**的注释会逐字命中断言。 */
const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/* 从 browser.js 里抠出一个具名函数，在沙箱里真跑。
 *
 * 为什么不用正则断言函数体：
 *   第 32 轮新增的逻辑里，唯一有真实分支的是 healthPillText（3 档文案）
 *   与 middleEllipsis（分「段」省略）。用正则只能断言"某句话在文件里出现过"，
 *   断言不出"两项都断时该说几项"、"预算 20 时该留下哪两段"。
 *   抠出来真跑，才能把**数字算错**这类问题挡住。
 *   （这与第 28 轮 normalizeBuildReport 那条测试是同一手法。）
 *
 * ★★ 默认**不改名**（asName = name），这一点踩过两次坑：
 *   ① 第一版把抠出来的函数一律改名成 `f` —— 同一段源码里要抠两个函数时，
 *      后定义的 `f` 会盖掉前一个（"identifier already declared"）。
 *   ② 改成可定制名字后，middleEllipsis 里那句 `displayWidth(text)` 仍然
 *      指向**原名**，而我把定义改名成了 `dw` → "displayWidth is not defined"。
 *   所以：名字必须保持原样，除非调用方明确要求改（跨函数引用时才安全的大改）。
 *   两个函数在 browser.js 里各自只出现一次，本来就不需要改名。 */
function extractFunction(source, name, asName = name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `应能在 browser.js 里找到 ${name}`);
  /* 找函数结束必须跳过**参数表**：直接从 `function name(` 之后第一个 `{`
   * 开始配对，在参数里出现默认值对象时会数错。 */
  const paramsEnd = source.indexOf(')', source.indexOf('(', start));
  let depth = 0;
  let i = source.indexOf('{', paramsEnd);
  for (; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  assert.ok(depth === 0, `${name} 的花括号应配对`);
  return source.slice(start, i + 1).replace(`function ${name}(`, `function ${asName}(`);
}

/* 剥掉 HTML 注释。
 * ★ 必须用**非贪婪**的 ([\s\S]*?) —— 第一版这里的星号被转义漏了，
 *   变成 `<!--\s\S]*?-->`：`\s` 与 `\S` 都只匹配**一个字符**，
 *   于是 "<!-- " 之后要正好跟一个字符再接 "-->"，几乎所有注释都匹配不到。
 *   后果很隐蔽：注释没被剥掉 → `htmlCode.indexOf('<div class="service-state">')`
 *   命中的是**注释里引用的那段 markup**（我在注释里逐字写了新旧结构对比），
 *   配对扫描从注释中间开始，立刻在下一行的 `>` 处闭合 →
 *   断言报"明细弹层不在服务栏内"。看起来像源码结构错了，其实是剥注释写错了。 */
const stripHtml = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

/* 找一条规则，读它的**声明块**（不含选择器）。
 *
 * ★★ 这里踩过一个真坑，值得写下来：第一版写的是
 *     new RegExp(`\\${selector.replace('.', '\\.')}\\{...`)
 *   以为 `\\` + `.` 会得到"字面的点"。
 *   实际：`'\\'` 在 JS 字符串里就是**一个反斜杠字符**，
 *   所以拼出来的是 `\` + `\.` + `nav-button` = `\\.nav-button`，
 *   在正则里 `\\` 是"一个字面的反斜杠" —— 于是整条正则要求
 *   CSS 里真的写着一个反斜杠。它永远匹配不到，而我第一反应是
 *   "测试挂了 = 源码没写 @hover"，差点去改**正确的源码**。
 *   教训：断言 `.nav-button:hover` 要用 indexOf / split，或者
 *   只在正则字面量里转义；不要用字符串拼正则来匹配含 `.` 的选择器。
 *   现在的做法是 indexOf 切分，没有转义层，也就没有这个坑。 */
function ruleOf(cssCode, selector) {
  const at = cssCode.indexOf(selector + '{');
  if (at < 0) return '';
  const end = cssCode.indexOf('}', at);
  return end < 0 ? '' : cssCode.slice(at + selector.length + 1, end);
}

/* 与 ruleOf 等价的查找，但容忍 `{` 之前的空白。
 *
 * ★ 为什么不直接改 ruleOf：ruleOf 还被本文件最后那条
 *   「负 letter-spacing / 文本容器 nowrap」测试用着，而那条是本轮
 *   **故意留红的真回归护栏**。新加一个容忍空白的查找函数，
 *   就能让重写过的断言读到 `.nav-actions {` 这种带空格的规则，
 *   同时保证那条护栏看到的源码逐字不变。
 *
 * 触发原因（第 43 条的"直接原因"）：新版 browser.css 把工具栏规则改写成
 *   多行 + `selector {` 形式，`indexOf(selector + '{')` 对它们一律返回空串
 *   —— 于是"规则找不到"被误报成"规则不存在"。 */
function ruleOfSpaced(cssCode, selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{');
  const m = re.exec(cssCode);
  if (!m) return '';
  const at = m.index + m[0].length;
  const end = cssCode.indexOf('}', at);
  return end < 0 ? '' : cssCode.slice(at, end);
}

/* 摘掉带 hidden 属性的整棵子树，只留下"用户真的看得见"的那部分 markup。
 *
 * ★ 这是本项目最贵的教训：判据一旦把隐藏桩一起统计，就会出现
 *   "元素在 DOM 里、功能在界面上没有"的假绿（隔离区/后台操作/上下文读数条
 *   都是这样消失的）。所以下面那条工具栏测试的控件集只在**可见**部分里取。
 *   配对扫描只认同名标签；调用前注释必须已经剥干净（顺序不能反，
 *   本文件上面那段"手写括号配对扫描把注释里的 <div 当真标签"就是反例）。
 *   属性名用 `\shidden(?=[\s>=/])` 精确匹配，避免命中 `aria-hidden`。 */
function removeHiddenSubtrees(markup) {
  let out = markup;
  for (;;) {
    const m = /<([a-z][a-z0-9]*)\b[^>]*\shidden(?=[\s>=/])[^>]*>/i.exec(out);
    if (!m) return out;
    const tag = m[1];
    const openEnd = m.index + m[0].length;
    const re = new RegExp(`<${tag}\\b|</${tag}\\s*>`, 'gi');
    re.lastIndex = openEnd;
    let depth = 1;
    let end = out.length;
    let hit;
    while ((hit = re.exec(out))) {
      if (hit[0].slice(0, 2) === '</') {
        depth -= 1;
        if (depth === 0) { end = re.lastIndex; break; }
      } else depth += 1;
    }
    out = out.slice(0, m.index) + out.slice(end);
  }
}

/* 规则块里声明的静止态底色。 */
function staticBackground(rule) {
  return (rule.match(/background\s*:\s*([^;]+)/) || [])[1]?.trim() || '';
}

/* 静止态底色是不是"浅色表面"。
 *
 * ★ 判据不是"某一种底色必须存在"，而是"全部底色落在同一套浅色表面词汇里" ——
 *   用户第 2 条投诉的是"浏览器风格白底 + 深黑实底 + 清新胶囊"三种表面同屏，
 *   所以真正要拦的是**深色/饱和实心块**（改前 .manager-button:#202123）。
 *   · transparent           → 是（幽灵/透明控件）
 *   · rgba(...,a<=0.15)     → 是（白底上的浅色蒙层，例如 rgba(0,0,0,.03)）
 *   · #fff / #ffffff / white→ 是
 *   · 已知的浅色表面令牌     → 是（将来把字面量收回令牌层时不该被判红）
 *   · 其余（深色 hex / 饱和 rgb / 陌生令牌）→ 否，必须显式决定后再进词汇表 */
const LIGHT_SURFACE_TOKENS = new Set([
  '--control-bg', '--control-hover', '--sunken', '--track', '--accent-soft-bg'
]);
function isLightSurface(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (raw === 'transparent' || raw === 'none') return true;
  if (raw === 'white' || /^#(?:fff|ffffff)$/i.test(raw)) return true;
  const token = raw.match(/^var\((--[a-z-]+)\)$/i);
  if (token) return LIGHT_SURFACE_TOKENS.has(token[1]);
  const rgb = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
    if (alpha <= 0.15) return true;
    const [r, g, b] = rgb.slice(1, 4).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.7;
  }
  const hex = raw.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.7;
  }
  return false;
}

test('the health pill collapses two status lights into one conclusion, and its text is computed, not hard-coded', () => {
  /* 第 32 轮（用户第 3 条）：「将分散的红绿灯状态整合为一个紧凑的健康状态胶囊：
   * 例如 `[ 🔴 服务未启动 · 2 项异常 ▾ ]`，点击展开查看本地工具与连接通道详情，
   * 而不是在外面散落多个红点文字。」
   *
   * ★ 先说改前到底散落了几份（这是"改前实测"，不是推演）：
   *   .service-state 里有三个并列的 <span>：
   *     · #downloadState（下载进度，绿色文字）
   *     · #mcpState  「● 本地工具」
   *     · #tunnelState「● 连接通道」
   *   后两个各带一个 8px 圆点，说的都是"服务能不能用"；
   *   而"当前工作区有没有与 MCP 同步"又在第二行另有一个圆点。
   *   同一件事被画了三遍，其中两遍是并列散落的。
   *
   * ★ 聚合之后必须守两件事，缺一不可：
   *   ① 结论文案由状态**算出来**（不是写死的四句 if）；
   *   ② 明细（本地工具 / 连接通道）必须仍然存在 ——
   *      合并到胶囊上不等于把明细删掉，用户要能查到"是哪一项断了"。 */
  const js = read('renderer/browser.js');
  const html = read('renderer/browser.html');

  /* ① 真的跑了这段逻辑，逐档比较输出。 */
  const source = stripJs(js);
  const body = extractFunction(source, 'healthPillText');
  const healthPillText = vm.runInNewContext(`(${body})`);

  assert.equal(healthPillText(true, true, false), '服务正常',
    '两项都正常时应给结论，而不是继续列两个"正常"');
  assert.equal(healthPillText(false, true, false), '本地工具未就绪',
    '只有一项异常时应**点名那一项** —— 用户下一步就是去修它');
  assert.equal(healthPillText(true, false, false), '连接通道未就绪',
    '同上，另一侧');
  assert.equal(healthPillText(false, false, false), '服务未启动 · 2 项异常',
    '★ 这一版必须与用户给的示例形态一致（「服务未启动 · 2 项异常」）');
  assert.equal(healthPillText(false, false, true), '状态检查中',
    '★ 首次心跳到达前必须是"检查中"而不是"未启动" —— '
    + '把"还没读到"当成"断了"是这类聚合胶囊最常见的误报');

  /* ② 可见面必须仍然能回答"哪一项断了"（保留的原意图）。
   *
   * ★ 改前这条契约靠明细弹层的两个文本节点承载；新版**有意废弃了弹层**
   *   （browser.css 的 .health-popover 是 display:none!important，
   *   browser.js 的 toggleHealthPopover 无条件 hidden = true），
   *   所以"明细还在不在"不能再拿弹层里的桩节点来证明 —— 那正是本项目
   *   "隐藏桩给出假绿"的老毛病：元素在 DOM 里，功能在界面上没有。
   *   等价判据换成胶囊**自身**的可见信息，三者缺一都会让
   *   "哪一项断了 / 去哪里修"重新变成用户查不到的信息：
   *     · 收起态点名单项异常（上面已逐档真跑 healthPillText）；
   *     · 悬浮 title 同时列出两项各自的状态；
   *     · 异常时点击直接跳「运行与连接」设置页。 */
  const cssCode = read('renderer/browser.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const htmlCode = stripHtml(html);
  const pillFn = source.match(/function renderHealthPill\(mcpRunning, tunnelRunning\)\s*\{[\s\S]*?\n\}/)?.[0] || '';
  assert.ok(pillFn, '应能在 browser.js 里截出 renderHealthPill');
  assert.match(pillFn, /本地工具：\$\{mcpRunning\s*\?\s*'运行中'\s*:\s*'未运行'\}/,
    '★ 悬浮 title 必须说明「本地工具」这一项到底是什么状态');
  assert.match(pillFn, /连接通道：\$\{tunnelRunning\s*\?\s*'已连接'\s*:\s*'未连接'\}/,
    '★ 同上，另一侧 —— 两项都要查得到，不能只报一个聚合数');
  assert.match(pillFn, /点击前往配置/, '异常时 title 必须给出下一步（去配置）');
  assert.match(pillFn, /textContent = healthPillText\(mcpRunning, tunnelRunning, checking\)/,
    '收起态文案必须来自那个纯函数（不得在渲染函数里另写一份字面量）');

  /* ③ 异常时必须真的能一步跳到设置页（"点击前往配置"不能只是文案）。 */
  const pillClick = source.match(/\$\('#healthPill'\)\.onclick = \(event\) => \{[\s\S]*?\n\};/)?.[0] || '';
  assert.ok(pillClick, '应能截出 #healthPill 的点击处理');
  assert.match(pillClick, /if \(!mcpRunning \|\| !tunnelRunning\)/,
    '★ 只有异常时才跳设置 —— 正常态点击不该把用户带走');
  assert.match(pillClick, /api\.openSettings\('deploy'\)/,
    '★ 异常时点击必须把用户送到「运行与连接」设置页');

  /* ③b 披露关系必须自洽：不得对**永久打不开**的节点声明披露。
   *
   * ★ 保留的原意图是"胶囊必须声明它控制哪个弹层"（aria-controls）。
   *   新版没有可展开的弹层，等价契约变成"声明了就必须真的打得开"：
   *   这正是这次重写的病根 —— 祖先 display:none!important 压掉 hidden=false，
   *   元素在 DOM 里却永远不可达。所以现在只拦"声明了却打不开"这一种组合，
   *   不去禁止将来把弹层真正恢复成可达。 */
  const pillTag = htmlCode.match(/<button id="healthPill"[^>]*>/)?.[0] || '';
  assert.ok(pillTag, '应有健康胶囊');
  const popoverTag = htmlCode.match(/<div id="healthPopover"[^>]*>/)?.[0] || '';
  const popoverUnreachable = /display:none\s*!important/.test(popoverTag)
    || /display:none/.test(ruleOfSpaced(cssCode, '.health-popover'));
  const advertisesPopover = /aria-controls="healthPopover"|aria-expanded=/.test(pillTag);
  assert.ok(!(popoverUnreachable && advertisesPopover),
    '★ 不得对永久隐藏的明细弹层声明 aria-controls / aria-expanded：'
    + '声明了却永远打不开，正是这次重写里"祖先 display:none!important 压掉 hidden=false"'
    + '那类缺陷。要么把弹层恢复成可达，要么不要声明');

  /* ③c 两个裸状态灯不得再**散落在可见栏里** —— 保留的原意图是
   *   改前 ③ 那句"明细不得再散落在栏里，只能是弹层的后代"，
   *   用户原话是"在外面散落多个红点文字"。
   *   它们现在只允许留在那个永久隐藏的兼容弹层里；可见工具栏里只要再冒出
   *   #mcpState / #tunnelState，就说明"聚合成一个结论"被回退了。
   *   （判据同样只看**可见**部分，不吃隐藏桩那套。） */
  const visibleBar = removeHiddenSubtrees(
    htmlCode.match(/<header class="browser-toolbar">[\s\S]*?<\/header>/)?.[0] || ''
  );
  assert.ok(visibleBar.includes('healthPill'), '应能截出可见工具栏（自检：胶囊必须在里面）');
  for (const id of ['mcpState', 'tunnelState']) {
    assert.ok(!visibleBar.includes(`id="${id}"`),
      `★ #${id} 不得再出现在可见工具栏里 —— 那正是用户说的"散落在外面多个红点文字"；`
      + '它现在只能留在隐藏的兼容弹层里');
  }
});

test('the workspace name keeps the last directory segment, and the full path stays reachable', () => {
  const js = read('renderer/browser.js');
  const css = read('renderer/browser.css');
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const source = stripJs(js);
  /* 第 32 轮（用户第 3 条）：「路径过长时自动中间省略（Middle Truncation，
   * 如 `D:/.../测试文件夹`），悬浮显示完整路径。」
   *
   * ★ 第 41 轮：中间省略那套实现**整体下线**（死代码清理）。
   *   `measureContext` / `textWidth` / `displayWidth` / `middleEllipsis`
   *   四个声明在 renderer/browser.js 里已经没有任何调用点 ——
   *   界面重写后切换器有意只显示**末段目录名**（整段完整），
   *   完整路径改由触发器 title 与展开菜单承担，"算到像素级的省略"不再需要。
   *
   *   所以原 ①–⑤（在 VM 里把函数抠出来真跑的那些断言）连同函数一起删除，
   *   换成下面这条**反向断言**：这套实现不得悄悄回来。
   *   若将来真要重新接线两端省略，请把 ①–⑤ 一并恢复（历史版本在 git 里，
   *   其中"末段完整 / 预算落在临界点 / 无预算不得膨胀"三条是这个需求的判据）。
   *
   * ★ 原意图一条都没丢 —— **末段目录名不能被切成残词 + 完整路径必须可查**：
   *   它现在由 ⑥（数据落点）与 ⑦（CSS 兜底省略层）承担，
   *   也就是从"省略算法"换成了"分层显示 + 悬浮可查"。
   *
   *   为什么当初必须自己写而不能靠 CSS：`text-overflow:ellipsis` 只能省略
   *   **末尾**，得到 `D:\Lenovo\Documents\测试文件…` —— 保留的恰是信息量最低的
   *   前缀；而路径里有信息量的是最后一段目录名。这条结论对将来仍成立。 */
  assert.doesNotMatch(source, /middleEllipsis|displayWidth\(|function textWidth\(|measureContext/,
    '★ 中间省略的实现已整体下线（切换器只显示末段目录名，整段完整）：'
    + '它没有调用点，留着只会让人以为这条链路还在用 —— '
    + '若重新接线，请把"末段完整 / 预算边界 / 无预算不膨胀"三条断言一并恢复');
  /* ⑥ 全路径必须可查（用户第 3 条逐字要求）。
   *
   * ★ 保留的原意图：「省略后必须把完整路径写进 title，否则用户永远看不到全路径」。
   *   新版切换器**有意只显示末段目录名**（可见文本 = baseName(路径)），
   *   所以"全路径可查"比改前更承重 —— 它现在完全落在 title 上，
   *   而且必须挂在**用户真正悬浮的那个可见按钮**上：
   *   挂在 #activeWorkspaceLabel 上没用，它是 .workspace-active-title，
   *   规则就是 display:none!important。 */
  assert.match(source, /const projectName = activeWorkspace \? baseName\(activeWorkspace\) : '未选择项目';/,
    '★ 可见的切换器文本应是**末段目录名**（baseName），而不是整条路径');
  assert.match(source, /const projectLabel = \$\('#activeProjectLabel'\);[\s\S]{0,140}projectLabel\.textContent = projectName;/,
    '★ 末段目录名必须写进可见节点 #activeProjectLabel（它才是 .workspace-project-title）');
  assert.match(source, /if \(trigger\) trigger\.title = activeWorkspace \? `当前项目与工作区：\$\{activeWorkspace\}` : '切换工作区';/,
    '★ 可见触发器 #workspaceTrigger 的 title 必须带完整路径（用户悬浮的就是它）');
  assert.match(source, /menuPath\.textContent = activeWorkspace \|\| '尚未选择工作目录';/,
    '★ 展开下拉后也要能直接读到完整路径');

  /* ⑦ ★★ CSS 那一层兜底 —— 保留的原意图不变："省略是**两层**的 = JS 算 + CSS 兜"。
   *
   * 新版 JS 不再做中间省略（可见文本直接就是末段目录名），于是 CSS 的
   * ellipsis 成了**唯一**的省略层，更不能缺。判据随之从
   * `.workspace-trigger strong` 移到 `.workspace-project-title`（strong 那条
   * 规则连元素一起没了）：**没有 min-width:0 时 flex 子项的默认 min-width:auto
   * 会让它撑到内容宽度**，overflow:hidden 形同虚设、省略号永不出现，
   * 窗口一窄末段目录名就是被裁掉而不是被省略。
   * min-width:0 在新版由 flex 链上的两个容器承担。 */
  const nameRule = ruleOfSpaced(cssCode, '.workspace-project-title');
  assert.ok(nameRule, '应有 .workspace-project-title 的规则（可见的末段目录名节点）');
  const nameCompact = nameRule.replace(/\s+/g, '');
  for (const decl of ['overflow:hidden', 'text-overflow:ellipsis', 'white-space:nowrap']) {
    assert.ok(nameCompact.includes(decl),
      `★ 末段目录名必须有 ${decl} —— CSS 是现在唯一的省略层；实测：${nameRule}`);
  }
  for (const selector of ['.workspace-trigger', '.workspace-trigger-text']) {
    const rule = ruleOfSpaced(cssCode, selector);
    assert.ok(rule, `应有 ${selector} 的规则`);
    assert.match(rule.replace(/\s+/g, ''), /min-width:0/,
      `★ ${selector} 必须有 min-width:0 —— flex 子项默认 min-width:auto 会把名字撑开，`
      + 'overflow:hidden 形同虚设、省略号永不出现（改前这条护栏在 .workspace-trigger strong 上）');
  }
});

test('the toolbar speaks one design language: a single 64px row, one height/radius/surface vocabulary, and no dark solid block', () => {
  /* 第 32 轮（用户第 2 条）：「消除目前"浏览器风格 + 深黑实底 + 清新胶囊"
   * 混搭的拼凑感，统一为现代沉浸式开发工具风格（参考 VS Code 或 Raycast）：
   * · 按钮样式统一：普通操作使用轻量幽灵按钮（Ghost Button，仅 Hover 显示背景），
   *   核心主操作采用同一规格的精致圆角按钮。
   * · 统一高度与边距：顶部两栏的高度分别规范为 40px 和 36px，
   *   所有图标与文字垂直居中对齐。」
   *
   * ★ 保留的原意图（第 32 轮用户第 2 条），以及新版界面下的等价判据 ——
   *   逐条替换，不是删掉判据：
   *   ① 「顶部两栏 40px / 36px」→ 两栏已合并为**单行 64px**；等价判据是
   *      "顶部栏只有一个高度基准、且可见 markup 里不再有第二行容器"。
   *   ② 「所有图标与文字垂直居中对齐」→ 原样保留（逐容器 align-items:center）。
   *   ③ 「统一高度与边距 / 同一规格的精致圆角」→ 等价判据是"全部控件的 height
   *      与 border-radius 都落在同一套词汇表里"（下面每个取值都写了理由）。
   *   ④ 「消除深黑实底拼凑感」→ 改前判据是"只允许 add-workspace 一个深色实心"；
   *      新版没有深色主操作了，等价判据是"**零个**深色实心控件"——
   *      任何控件把底色改回 #202123 那类深色，这条立刻红。
   *   ⑤ 控件集仍然**从 markup 自动推导**（全集而不是抽样），新加的控件自动进判据。
   *   ⑥ 判据只统计**可见**控件：隐藏的弹层 / 菜单 / 兼容桩一律不算 ——
   *      它们的 stub 正是本项目"隐藏桩给出假绿"的来源，本测试不吃这一套。 */
  const html = read('renderer/browser.html');
  const css = read('renderer/browser.css');
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const htmlCode = stripHtml(html);

  /* ① 单行 64px：只有一个高度基准，而且被顶部栏真正消费。
   *    （改前是"两行各自引用令牌、40 + 36 = 64"；两行并一行后，
   *      等价契约就是"这一栏只有一个高度基准"。） */
  assert.match(css, /--toolbar-height:64px/,
    '顶部栏应只有一个高度基准 64px（原「40 + 36 两行」已合并为单行）');
  assert.match(ruleOfSpaced(cssCode, '.browser-toolbar').replace(/\s+/g, ''),
    /height:var\(--toolbar-height\)/,
    '顶部栏必须真的消费那个 64px 基准，而不是自己另写一个高度');
  const stash = htmlCode.match(/<div class="compat-hidden-stash"[^>]*>[\s\S]*?<\/div>/)?.[0] || '';
  assert.ok(stash.includes('workspace-bar'), '旧第二行容器只能作为隐藏兼容节点存在');
  assert.ok(!htmlCode.replace(stash, '').includes('workspace-bar'),
    '★ 可见工具栏里不应再有第二行容器（workspace-bar）—— 两行 40/36 已合并为单行 64px');

  /* ② 垂直居中：工具栏里每一个 flex/grid 的容器都必须 align-items:center。
   *    用户第 2 条明确要求"所有图标与文字垂直居中对齐" ——
   *    实测改前 8 项 / 5 项的垂直中心极差都是 0px（已经是对的），
   *    所以这里守的是**别在重构中改坏**，而不是修一个坏掉的东西。 */
  for (const selector of ['.toolbar-main', '.nav-actions', '.toolbar-left', '.toolbar-right',
    '.service-state', '.workspace-switcher', '.workspace-trigger', '.workspace-trigger-text',
    '.ai-tools-group', '.task-strip', '.health-pill']) {
    const rule = ruleOfSpaced(cssCode, selector);
    assert.ok(rule, `应有 ${selector} 的规则`);
    assert.match(rule.replace(/\s+/g, ''), /align-items:center/,
      `${selector} 必须显式声明 align-items:center（用户第 2 条「所有图标与文字垂直居中对齐」）`);
  }

  /* ②b ★ 行布局：左组 + 右组，右组靠 margin-left:auto 贴右。
   *     改前判据是 .toolbar-main 的 `grid-template-columns:auto 1fr auto`；
   *     新版主容器是 flex（grid-template-columns 与 display:flex 并存时是死属性），
   *     等价契约 = "右组自己负责靠右"，否则两行并一行后右侧会散架。 */
  const mainRule = ruleOfSpaced(cssCode, '.toolbar-main');
  assert.ok(mainRule, '应有 .toolbar-main 的规则');
  assert.match(mainRule.replace(/\s+/g, ''), /display:flex/, '工具栏主容器应是 flex 单行');
  assert.match(ruleOfSpaced(cssCode, '.toolbar-right').replace(/\s+/g, ''), /margin-left:auto/,
    '★ 右组必须靠 margin-left:auto 贴右（原判据是 .toolbar-main 的 `auto 1fr auto`）');

  /* ③ 控件集从 markup 自动推导，而且只看**可见**部分。 */
  const toolbarHtml = htmlCode.match(/<header class="browser-toolbar">[\s\S]*?<\/header>/)?.[0] || '';
  assert.ok(toolbarHtml, '应能截出工具栏 markup');
  const visibleToolbar = removeHiddenSubtrees(toolbarHtml);
  assert.ok(!visibleToolbar.includes('healthPopover') && !visibleToolbar.includes('addWorkspace'),
    '★ 判据必须只统计可见控件：隐藏的明细弹层与兼容桩都不算（否则就是"隐藏桩给假绿"）');
  const controlClasses = [...new Set(
    [...visibleToolbar.matchAll(/<button[^>]*class="([^"]+)"/g)].map((m) => m[1])
  )];
  assert.ok(controlClasses.length >= 5,
    `可见工具栏里应至少取出 5 个按钮控件，实际取到 ${controlClasses.length} 个（判据失去意义时会先在这里红）`);

  /* ④ 一套词汇表：height 与 border-radius 只能取封闭清单里的值。
   *    · height：38px（带字控件）/ 34px（图标按钮）/ 18px（内嵌同步圆点）/
   *      100%（填满选择器）—— 原判据是"两行分别 40px 和 36px"，
   *      合并成单行后的等价物就是"高度们从一张封闭清单里取"：
   *      新控件若随手写 44px，会在下面红。
   *    · border-radius：四个 --radius-* 令牌（4 / 6 / 8 / 18px）与 50%（圆点）。
   *      字面量必须**恰好等于**某一档才算"同一规格"。令牌化进度归
   *      tests/chat-ui-compact.test.js 的 .manager-button 令牌断言管，这里不重复。
   *    · Hover：可点控件必须有反馈（用户第 2 条「仅 Hover 显示背景」的原始意图）；
   *      health-pill 只在异常态可点，所以允许它的 Hover 带状态前缀。 */
  const HEIGHT_VALUES = new Set(['18px', '34px', '38px', '100%']);
  const RADIUS_VALUES = new Set(['4px', '6px', '8px', '18px', '50%']);
  const RADIUS_TOKENS = new Set(['--radius-sm', '--radius-md', '--radius-lg', '--radius-pill']);
  for (const cls of controlClasses) {
    const rule = ruleOfSpaced(cssCode, `.${cls}`);
    assert.ok(rule, `应有 .${cls} 的规则（工具栏控件不得无样式）`);
    const compact = rule.replace(/\s+/g, '');
    const height = (compact.match(/height:([^;]+)/) || [])[1] || '';
    assert.ok(HEIGHT_VALUES.has(height),
      `★ ${cls} 的高度必须来自工具栏统一清单（${[...HEIGHT_VALUES].join(' / ')}），实测 ${height || '(未声明)'}`);
    const radius = (compact.match(/border-radius:([^;]+)/) || [])[1] || '';
    const radiusToken = (radius.match(/^var\((--[a-z-]+)\)$/) || [])[1];
    assert.ok(RADIUS_VALUES.has(radius) || RADIUS_TOKENS.has(radiusToken),
      `★ ${cls} 的圆角必须是同一规格的一档（${[...RADIUS_VALUES].join(' / ')} 或 --radius-* 令牌），实测 ${radius || '(未声明)'}`);
    assert.ok(new RegExp(`\\.${cls}(?:\\.[\\w-]+)?:hover`).test(cssCode),
      `★ ${cls} 必须有 Hover 反馈（用户第 2 条「仅 Hover 显示背景」：可点控件不能毫无反馈）`);
  }

  /* ⑤ 零个深色实心块 —— 这是"深黑实底拼凑感"那条投诉的正对判据。 */
  const darkBlocks = controlClasses.filter(
    (cls) => !isLightSurface(staticBackground(ruleOfSpaced(cssCode, `.${cls}`)))
  );
  assert.deepEqual(darkBlocks, [],
    `★ 工具栏不允许出现深色 / 饱和实心块，实测：${darkBlocks.join(', ') || '(无)'}。`
    + '（改前 .manager-button:#202123 与 .add-workspace 都是深色实心，同屏互相抢注意力 —— '
    + '这正是用户说的"深黑实底拼凑感"的来源；新版统一为浅色微实体，这条守住它别回来）');

  /* ⑥ 设置按钮是这一栏里"轻实体"那一档（带明确边框 + 实体底色）——
   *    保留改前 ③b 的分档意图；是否已收回令牌层由另一条测试守。 */
  const mgrCompact = ruleOfSpaced(cssCode, '.manager-button').replace(/\s+/g, '');
  assert.match(mgrCompact, /border:1pxsolid/, '设置按钮应有明确边框（轻实体分档）');
  assert.match(mgrCompact, /background:/, '设置按钮应有实体底色');
});

test('every text container in the toolbar forbids line wrapping, and no rule introduces negative letter spacing', () => {
  /* 第 32 轮（用户第 1 条）：「修复"本地工具"、"连接通道"等文字笔画粘连、
   * 重叠变形的问题。检查相关容器的 CSS，确保没有负的 letter-spacing，
   * 给文本容器添加 white-space: nowrap 和合理的 gap，
   * 防止 Flex 布局在压缩时导致汉字变形。」
   *
   * ★★ 这条护栏的判据来自**改前实测**，而且实测结果否定了用户的一个推断 ——
   *   必须把这个结论留在代码里，否则下一轮还会有人照着"负字距"去查。
   *
   *   _probe-round32-precise.js 在运行中的应用里遍历了工具栏全部 23 个文本节点：
   *     · 负 letter-spacing 的数量是 **0**（整栏，五档宽度都是 0）；
   *     · #mcpState「本地工具」  w=76  scrollW=76  文本 rectW=52 natural=52 单行
   *     · #tunnelState「连接通道」w=76  scrollW=76  文本 rectW=52 natural=52 单行
   *   也就是说：这两个元素**自身没有被压缩**（盒宽 76 > 自然宽 52），
   *   负字距也**不存在**。所以本轮不是"修掉一个已发生的挤压"，
   *   而是**消除挤压的成因** —— 改前它们是 flex 里 white-space:normal 的裸文本
   *   （min-width:auto + flex-shrink:1），一旦空间不足会**逐字折行**；
   *   中文单字占满 em box，两个字被塞进两行看起来就是"笔画粘连、重叠变形"。
   *
   * 所以这条测试守三件事：
   *   ① 全文件不得出现负 letter-spacing（防的是**将来**有人为了"排得紧"加上）；
   *   ② 工具栏里每个"装文字的盒子"都必须 white-space:nowrap；
   *   ③ 图标与文字之间的 gap 必须是显式声明过的（不能靠默认 0）。 */
  const css = read('renderer/browser.css');
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');

  /* ① 负字距：全文件扫描，一个都不许有。
   *    ★ 判据用"--letter-spacing:-" 而不是只搜 "letter-spacing" ——
   *      本文件允许出现 letter-spacing 这个属性名（比如将来写 normal），
   *      要拦的是**负值**。同时把 0 与正值放行，因为它们不会造成咬字。 */
  const negative = [...cssCode.matchAll(/letter-spacing:\s*(-[\d.]+(?:px|em|rem|%))/g)].map((m) => m[1]);
  assert.deepEqual(negative, [],
    `★ 不得使用负 letter-spacing —— 中文字面近似正方形、每个字填满 em box，`
    + `负字距只会让笔画互相咬进去。实测到的负值：${negative.join(', ')}`);

  /* ② 每个装文字的盒子必须 nowrap。
   *    ★ 这与"哪一行折了"无关 —— 改前实测只有 #activeWorkspace 一处真折行，
   *      但它折了是因为 max-width + flex 压缩。这里守的是**预防**：
   *      工具栏里任何一处文字都不该有折行的可能，因为这一栏的高度是
   *      跨进程硬约束（写死 76px），折一行就会顶破布局。 */
  /* ★ 第 41 轮：列表里原来的 '.health-popover span' 已删除。
   *   那个浮层是**永久隐藏的兼容节点**（browser.css 里 .health-popover{display:none !important}，
   *   browser.html 里同样写着 hidden），它的文字永远不会渲染，
   *   给它加 nowrap 守不住任何东西 —— 而它当初有规则，是因为它**曾经可见**。
   *   同一批文字的真实落点是 #healthPill 里的 .health-pill span（仍在本表内），
   *   所以删掉这一项不会让"工具栏文字不许折行"出现缺口。 */
  /* ★ 第 41 轮：'.workspace-trigger strong' → '.workspace-project-title'。
   *   工作区切换器改成分层下拉后，触发器里那一行可见文字是
   *   .workspace-project-title（#activeProjectLabel）；原来的
   *   <strong class="workspace-active-title"> 已被 display:none 收掉
   *   （browser.css 里写着"隐藏重复臃肿的第二行文字"），
   *   给一个永远不渲染的元素要求 nowrap 是空判据。 */
  const textBoxes = ['.app-name', '.page-state', '.download-state', '.health-pill span',
    '.workspace-project-title', '.switch-state',
    '.task-strip b', '.task-strip small', '.task-progress-text'];
  for (const selector of textBoxes) {
    /* ★ 用 ruleOfSpaced（容忍 `{` 前的空白）而不是 ruleOf —— 本文件的规则
     *   有的压成单行、有的分多行，`indexOf(selector + '{')` 只能找到前者。
     *   这跟本项目那条教训同源：**判据要指向结构性质，不能指向书写格式**。 */
    const rule = ruleOfSpaced(cssCode, selector);
    assert.ok(rule, `应有 ${selector} 的规则`);
    assert.match(rule, /white-space:\s*nowrap/,
      `★ ${selector} 必须 white-space:nowrap —— `
      + '改前「本地工具」/「连接通道」就是 white-space:normal 的裸文本，'
      + '被 flex 压缩时会逐字折行（中文看起来就是笔画粘连）'
      + '（`white-space: nowrap` 与 `white-space:nowrap` 完全等价，不比空格）');
  }

  /* ③ gap 必须显式声明（用户第 1 条「合理的 gap」）。
   *    ★ 只断言"有 gap"挡不住把值改成 0；这里断言它**显式存在且不为 0**。
   *      区间取 2~10px：导航组实测 2px（三个图标按钮是**同族的一组**，
   *      间距小才读成一个 group；改成 8px 会让它们看起来是三个独立按钮），
   *      而图标与文字之间是 6~8px。所以下限必须允许 2px —— 这不是放水，
   *      是两处确实有不同的功能需求。 */
  for (const selector of ['.nav-actions', '.service-state', '.health-pill',
    '.workspace-trigger', '.task-strip', '.manager-button']) {
    /* 同样用 ruleOfSpaced：本文件有的规则压成单行、有的分多行，
     * 判据守的是"gap 显式存在且合理"，不是书写格式。 */
    const rule = ruleOfSpaced(cssCode, selector);
    const gap = Number(rule.match(/gap:\s*(\d+)px/)?.[1]);
    assert.ok(Number.isFinite(gap), `${selector} 必须显式声明 gap（不得依赖默认 0）`);
    assert.ok(gap >= 2 && gap <= 10,
      `${selector} 的 gap 应在 2~10px（用户第 1 条「合理的 gap」），实测 ${gap}px`);
  }

  /* ④ 字体栈：与用户给的示例逐族对齐。
   *    ★ 比较前必须归一化空格 —— 第 31 轮曾因"逗号后有没有空格"
   *      误报过一次。这里只比较**族名序列**是否包含用户点名的四个。 */
  const stack = css.match(/:root\{[\s\S]*?font-family:([^;]+);/)?.[1] || '';
  const families = stack.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
  for (const required of ['system-ui', '-apple-system', 'PingFang SC', 'Microsoft YaHei']) {
    assert.ok(families.includes(required),
      `★ 字体栈必须包含 "${required}"（用户第 1 条给的示例）—— 实测族名：${families.join(', ')}`);
  }
  assert.ok(families[families.length - 1] === 'sans-serif', '字体栈必须以 sans-serif 收尾');

  /* ⑤ 非令牌文件不得新写颜色字面量 —— 这里断言的是"重写这一轮没有偷偷放宽"。
   * ★ 第 41 轮：删掉了原来的 `--toolbar-height:90px（48 + 42）`。
   *   那是"两行工具栏"的加法结果；工具栏后来压成**单行**，
   *   高度契约变成 64px，已由本文件另一条断言（`--toolbar-height:64px`
   *   + `.browser-toolbar{height:var(--toolbar-height)}`）正式守着。
   *   同一条事实留两份取值必然分叉：一份改了、另一份变成假红，
   *   而这条断言的位置（夹在字体栈与降级规则之间）与"高度契约"也无关系。 */
  assert.match(css, /--toolbar-height:64px/,
    '顶部栏总高度应为 64px（单行工具栏）—— 与 .browser-toolbar 的高度契约同一处真源');

  /* ⑤b 降级规则断言：窄屏时把承重信息合理收起。
   * ★ 第 41 轮重锚：原判据钉死 `@media(max-width:460px){` 且要求 `{` 紧贴
   *   媒体查询、中间不得换行 —— 而响应式改成了 1450 / 1150 / 900 三档、
   *   规则体换行书写，于是重排一次就报"没有降级规则"这种假红。
   *   判据回到意图本身：**存在某个断点把 .page-state 收起**（断点取多少、
   *   规则怎么写都不影响这条性质）。 */
  assert.match(css, /@media\(max-width:\d+px\)\{[\s\S]{0,600}?\.page-state\{display:none\}/,
    '页面状态（加载中/失败）是承重信息，窄屏时应合理收起');

  /* ⑥ ★★ 往上弹的浮层不得用 bottom:100% —— 这是**真机实测抓出来的缺陷**。
   *
   * 静态看 `bottom:100%` 像是对的（"贴住容器上沿"），实测才知道：
   *   100% 解的是容器的**高度**（第二行 36px），不是"顶边"。
   *   于是弹层下边 = 76 − 36 = 40，再减 margin-bottom:6 → 下边 y=34；
   *   而弹层实测高 54.67px → 顶边 **y = −20.67**，
   *   第一行（工作区名/状态/时间）被窗口上沿整个**裁掉**。
   * 所以这里守的是"必须 bottom:0"（贴第二行底边往上生长）。
   * ★ 这条断言只能靠几何实测发现 —— 静态检查永远看不出 −20.67 这个数。 */
  const wsHealthRule = ruleOf(cssCode, '.workspace-health-popover');
  assert.ok(wsHealthRule, '应有 .workspace-health-popover 的规则');
  assert.match(wsHealthRule, /bottom:0;/,
    '★ 往上弹的浮层必须 bottom:0 —— bottom:100% 会把它推进第一行、'
    + '被窗口上沿裁掉（实测顶边 y=−20.67，内容整块不可见）');
  assert.doesNotMatch(wsHealthRule, /bottom:100%/,
    '★ 不得退回 bottom:100%（100% 解的是容器高度而不是顶边）');
});