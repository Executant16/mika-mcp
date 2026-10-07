const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');

test('all app icon surfaces use the single generated icon source', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const main = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');
  assert.equal(pkg.build.win.icon, 'electron/app-icon.ico');
  assert.equal(pkg.build.nsis.installerIcon, 'electron/app-icon.ico');
  assert.equal(pkg.build.nsis.uninstallerIcon, 'electron/app-icon.ico');
  assert.equal(pkg.build.nsis.installerHeaderIcon, 'electron/app-icon.ico');
  assert.equal(pkg.build.nsis.createDesktopShortcut, 'always');
  assert.match(main, /app-icon\.png/);
  assert.doesNotMatch(main, /tray\.png/);
  assert.doesNotMatch(JSON.stringify(pkg), /build\/icon\.png/);
});

test('legacy icon files are not used as build inputs', () => {
  assert.equal(fs.existsSync(path.join(root, 'electron', 'tray.png')), false);
  assert.equal(fs.existsSync(path.join(root, 'build', 'icon.png')), false);
});

test('the in-app SVG brand marks are byte-identical and share the icon generator\'s geometry', () => {
  /* 第 29 轮（用户第 8 条）：「网页 MCP 助手的图标怎么改掉了？上一版的问题就是
   * 图标偏移了，你怎么改掉了？」
   *
   * ★ 现场还原：原始品牌标记（见归档-原始文件/index.html.原始备份 第 17 行）是
   *     <path d="M6.5 7.1 11.3 12 6.5 16.9"/> + <path d="M13.5 16.9H17.6"/>
   *   —— 终端提示符 ›_，与 scripts/generate-icon.js 画的是同一个符号。
   *   第 14 轮之后某一轮，渲染层的品牌标记被改成了"窗口框 + 双尖角"，
   *   而应用图标（app-icon.png / .ico）没跟着换 —— 于是同一个应用里有了两套造型。
   *   用户看到的"图标改掉了"就是这个：托盘/任务栏是 ›_，界面里却不是。
   *
   * 这条护栏要挡的正是**两套造型再次分叉**，所以判据不能是"index.html 里有 svg"
   * （那太弱），也不能只是"两处彼此相同"（两处可以一起被改错），
   * 必须把它们与**唯一真源** generate-icon.js 对齐：
   *   从生成器解析出 512 画布上的 CHEVRON / UNDERSCORE 坐标，
   *   按 24/512 换算成 viewBox 24 下的值，再要求两处 <path> 逐字匹配。
   * 这样"改生成器不改界面"和"改界面不改生成器"都会红。 */
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  const generator = fs.readFileSync(path.join(root, 'scripts', 'generate-icon.js'), 'utf8');

  /* 从生成器读真值。写死坐标会让这条断言变成"抄了一份快照"，
   * 生成器改了它不会红 —— 那就失掉了"同源"的意义。
   * 坐标允许小数：第 30 轮把图标放大到"字形占画布 72%"后，
   * 缩放系数 1.401673 让坐标不再是整数（整数化会把字形从 72% 挪到 71.x%）。
   * 只收整数会让这条护栏变成"改了生成器就报错"，那是护栏本身的问题，不是改动的。 */
  const chevron = generator.match(/const CHEVRON = \[([\d.,\s]+)\];/);
  const underscore = generator.match(/const UNDERSCORE = \[([\d.,\s]+)\];/);
  assert.ok(chevron && underscore, 'generate-icon.js 应定义 CHEVRON 与 UNDERSCORE 坐标');
  const c = chevron[1].split(',').map((n) => Number(n.trim()));
  const u = underscore[1].split(',').map((n) => Number(n.trim()));
  const k = 24 / 512;
  /* 四舍五入到两位小数 —— 必须与界面里那组坐标的取值方式一致，
   * 否则 4.805 会被写成 4.8，而界面写 4.81，差一个末位就整条红。
   * （用 toFixed 截断会踩这个坑：Math.round 才是"取两位"。） */
  const f = (n) => (Math.round(n * k * 100) / 100).toString();

  /* 生成器把尖角分两段直线绘制（line 两次 + circle 补接缝），
   * SVG 里等价的写法是一条两段折线。 */
  const expectedChevron = `<path d="M${f(c[0])} ${f(c[1])} ${f(c[2])} ${f(c[3])} ${f(c[4])} ${f(c[5])}" stroke="#ffffff"/>`;
  const expectedUnder = `<path d="M${f(u[0])} ${f(u[1])}H${f(u[2])}" stroke="#6c8cff"/>`;

  /* 当前两处内联 SVG 的容器类名各不相同（实测）：
   *   .boot-logo           启动遮罩
   *   .brand-mark          侧栏
   * 关于页当前使用 mascot.jpg，不再重复内联品牌 SVG。
   * 所以按"是否含这一个定位 path"来数，而不是按容器类名。 */
  assert.equal(html.split(expectedChevron).length - 1, 2,
    `两处品牌标记的尖角必须逐字等于从 generate-icon.js 换算出的几何：${expectedChevron}`);
  assert.equal(html.split(expectedUnder).length - 1, 2,
    `两处品牌标记的下划线必须逐字等于从 generate-icon.js 换算出的几何：${expectedUnder}`);
  /* 附带守一下"这两处仍然存在"：只有两处 path 匹配、却没有任何容器，
   * 说明它们被塞进了别的地方（或重复到第四个位置）。 */
  assert.equal((html.match(/class="brand-mark/g) || []).length, 1,
    '侧栏应有 .brand-mark 容器（+ 启动遮罩的 .boot-logo；关于页使用头像图片）');
  assert.equal((html.match(/class="boot-logo"/g) || []).length, 1,
    '启动遮罩应有 .boot-logo 容器');

  /* 反向：那一版"窗口框 + 双尖角"不得复活。
   * 只断言"没有这个 path"不够 —— 要断言的是一整类写法：
   * 那些路径的共同特征是同时出现两条镜像尖角（12.5→15→17.5 这种），
   * 而生成器的描边只有一条折线。 */
  assert.doesNotMatch(html, /M9 12\.5 6\.5 15 9 17\.5/,
    '不应再有"窗口框 + 双尖角"那一版造型（它会与应用图标分叉）');
  assert.doesNotMatch(html, /M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z/,
    '不应再有"窗口框"路径');
  /* 两个色值也必须与生成器一致（白 + 强调蓝 #6c8cff），
   * 否则会变成"形状一样但配色不同"的另一种分叉。 */
  assert.match(generator, /\[108, 140, 255, 255\]/, '生成器的下划线应使用强调蓝 rgb(108,140,255)');
  assert.equal((html.match(/stroke="#6c8cff"/g) || []).length, 2,
    '两处下划线都应是 #6c8cff（=rgb(108,140,255)）');

  /* ★ 第 30 轮补充（负向验证抓到的缺口）：上面只比对了**坐标**，
   *   把生成器的 SW 从 61.674 改回 44 时，测试仍然全绿 ——
   *   因为路径逐字没变，只是笔画变细了。那正是"形状同源但观感分叉"，
   *   用户看到的会是"界面图标比任务栏图标细一圈"。
   *
   *   所以线宽也必须从生成器反算并钉住：这**不是抄一份快照** ——
   *   3.11 这个数字由"字形占画布 72% × 笔宽/字宽 16.73%"唯一决定，
   *   生成器的 SW 一改，这里就会跟着变，与 CSS 里写死的值对不上 → 红。
   *
   *   断言的是 CSS 中**两处** svg 的 stroke-width 都属于同一个值，
   *   而不只是"存在一个等于期望值的"：两处徽标本来就是同一个符号，
   *   允许它们各不相同等于允许分叉。 */
  const swMatch = generator.match(/const SW = ([\d.]+);/);
  assert.ok(swMatch, 'generate-icon.js 应定义 SW（笔画宽度）');
  const expectedStroke = (Math.round(Number(swMatch[1]) * k * 100) / 100).toString();
  const css = fs.readFileSync(path.join(root, 'renderer', 'styles.css'), 'utf8');
  /* 只取**品牌徽标那几条规则**里的 stroke-width。扫全文件会捞到无关值
   * （本轮实测捞到一条 `stroke-width: 2`，属于别的图形），
   * 那是"断言扫错范围"，不是"笔宽分叉"—— 两者在输出上长得一样。
   * 徽标一共两个选择器：`.brand-mark svg` 与 `.boot-logo svg`。 */
  const brandRules = [...css.matchAll(/\.(?:brand-mark(?:\.large)?|boot-logo)\s*svg\{[^}]*\}/g)]
    .map((m) => m[0]);
  const strokes = brandRules.flatMap((rule) => [...rule.matchAll(/stroke-width:\s*([\d.]+)/g)].map((m) => m[1]));
  assert.ok(strokes.length >= 2,
    `.brand-mark svg 与 .boot-logo svg 都应声明 stroke-width（实得 ${strokes.length} 条，命中规则 ${brandRules.length} 条）`);
  for (const value of strokes) {
    assert.equal(value, expectedStroke,
      `笔画宽度必须等于生成器 SW 换算值 ${expectedStroke}（实得 ${value}）—— 形状同源但笔宽分叉，用户看到的是"界面图标比任务栏细一圈"`);
  }
});
