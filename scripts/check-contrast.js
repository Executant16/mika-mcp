#!/usr/bin/env node
'use strict';
/* ============================================================================
 * check-contrast.js —— 语义色对比度守卫
 * ----------------------------------------------------------------------------
 * 为什么在仓库里（而不是在仓库外的工具目录）：
 *   本文件原先只存在于 gpt-webcodex-ui-重构/ —— 那是本机优化工具目录，CI
 *   访问不到。而 DESIGN.md §六.7 已经把"语义色对比度不达标"写成硬规则。
 *   规则如果没有自动手段执行，就只能靠人记得手动跑脚本，等于没有规则。
 *   故移入 scripts/，成为门禁的一环。
 *
 * 用途：令牌层（renderer/design-tokens.css）的任何改动，都要用它复检一遍。
 *       它从文件里**真实解析**令牌值（不写死颜色），再按"实际渲染背景"
 *       复算每个消费场景，输出不达标清单。
 *
 * 为什么不能按纯表面算：
 *   消费点大量压在"同色半透明底"（如 rgba(108,140,255,.1)）与渐变端点上。
 *   必须先用 alpha 合成出真实底色，否则会高估对比度。
 *
 * 标准：
 *   文字用途 ≥ 4.5:1（WCAG AA 正文）
 *   图形用途 ≥ 3.0:1（WCAG AA 非文本）
 *
 * 用法：
 *   node scripts/check-contrast.js            # 检查，有违规则退出码 1
 *   node scripts/check-contrast.js --json     # 输出 JSON（供 CI 解析）
 *   node scripts/check-contrast.js --snapshot # 导出当前实测值快照（人工比对用）
 *
 * 维护提示：新增消费点（新的语义色用法）时，应在 SCENARIOS 里补一条。
 *           改令牌值后若最紧余量逼近 1.0，应重新审视该消费点的设计。
 * ========================================================================== */
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOKENS = path.resolve(__dirname, '..', 'renderer', 'design-tokens.css');

/* ---------- 颜色数学 ---------- */
const P = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const H = (r, g, b) => '#' + [r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (h) => { const [r, g, b] = P(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return (hi + 0.05) / (lo + 0.05); };
/** 把 fgHex 以 alpha 铺在 baseHex 上的实际颜色 */
const over = (fgHex, a, baseHex) => { const F = P(fgHex), B = P(baseHex); return H(F[0] * a + B[0] * (1 - a), F[1] * a + B[1] * (1 - a), F[2] * a + B[2] * (1 - a)); };

/* ---------- 解析令牌（含主题继承）---------- */
function loadTokens(file) {
  const css = fs.readFileSync(file, 'utf8');
  const i = css.indexOf(':root[data-theme="light"]');
  const rootSeg = css.slice(css.indexOf(':root {'), i);
  const lightSeg = css.slice(i);
  const grab = (seg, n) => { const m = seg.match(new RegExp('--' + n + ':\\s*(#[0-9a-f]{6})', 'i')); return m ? m[1] : null; };
  const names = ['blue', 'blue-2', 'violet', 'cyan', 'green', 'yellow', 'red', 'muted-2',
    'bg', 'sidebar', 'surface', 'surface-2', 'surface-3', 'text', 'muted', 'btn-primary-bg',
    /* ★ 第 31 轮：构建控制台从字面量 #080b10/#f4f7fb 改为消费
     *   --console-bg / --console-text 令牌。于是"控制台上的字"有了
     *   新的真实背景，必须被纳入场景 —— 改前它的取值不在令牌体系里，
     *   这个脚本根本看不到它（这正是"字几乎看不见"能长期存在的原因）。 */
    'console-bg', 'console-text'];
  const T = {};
  for (const t of ['dark', 'light']) {
    T[t] = {};
    for (const n of names) T[t][n] = t === 'light' ? (grab(lightSeg, n) || grab(rootSeg, n)) : grab(rootSeg, n);
    T[t].surface2 = T[t]['surface-2'];
    T[t].surface3 = T[t]['surface-3'];
    T[t].white = '#ffffff';
  }
  // 代码块底（消费点里的字面量，非令牌）
  T.dark.code = '#080b10'; T.light.code = '#f4f7fb';
  return T;
}

/* ---------- 消费场景 ----------
 * 每项：[类别, 描述, 前景令牌名, 背景, 门槛]
 * 背景可以是：令牌名 / {tint:[旧色相字面量, alpha, 底]} / 字面量
 * 注意：同色半透明底用的是**硬编码旧色相**（不随令牌变化）。 */
const LIT = { blue: '#6c8cff', green: '#42d392', red: '#ff6b79', yellow: '#f4be5b' };
const SCENARIOS = [
  // —— 图形（≥3:1）——
  ['图形', '.action-icon blue @ rgba(blue .1)/surface', 'blue', { tint: ['blue', .10, 'surface'] }, 3],
  ['图形', '.step-number blue @ rgba(blue .11)/surface', 'blue', { tint: ['blue', .11, 'surface'] }, 3],
  ['图形', '.task-file b blue @ rgba(blue .1)/surface-2', 'blue', { tint: ['blue', .10, 'surface-2'] }, 3],
  ['图形', '.task-step.in_progress i blue @ surface-3', 'blue', 'surface-3', 3],
  ['图形', '.task-step.completed i green @ surface-3', 'green', 'surface-3', 3],
  ['图形', '.task-step.failed i red @ surface-3', 'red', 'surface-3', 3],
  ['图形', '.health-item.passed>i green @ rgba(green .1)/surface-2', 'green', { tint: ['green', .10, 'surface-2'] }, 3],
  ['图形', '.health-item.failed>i red @ rgba(red .1)/surface-2', 'red', { tint: ['red', .10, 'surface-2'] }, 3],
  ['图形', '.runtime-orbit i muted-2 @ surface', 'muted-2', 'surface', 3],
  ['图形', '.runtime-orbit i muted-2 @ sidebar', 'muted-2', 'sidebar', 3],
  ['图形', '.progress-ring blue @ surface', 'blue', 'surface', 3],
  ['图形', '.progress-track 渐变 blue @ 轨道 surface-3', 'blue', 'surface-3', 3],
  ['图形', '.progress-track 渐变 violet @ 轨道 surface-3', 'violet', 'surface-3', 3],
  ['图形', '.progress-track 渐变 cyan @ 轨道 surface-3', 'cyan', 'surface-3', 3],
  ['图形', '.toggle:checked blue-2 @ surface', 'blue-2', 'surface', 3],
  // —— 文字（≥4.5:1）——
  // 第 21 轮删掉 `.eyebrow` 场景：该元素已从 index.html 移除，
  // 场景名里的选择器在 DOM 中再也匹配不到任何节点。留着它会让人误以为
  // "有一处蓝色小字在用 blue @ surface"，实际上那只是 `.node span` 的重复项。
  ['文字', '.node span blue @ surface', 'blue', 'surface', 4.5],
  ['文字', '.environment-list button blue @ surface-2', 'blue', 'surface-2', 4.5],
  ['文字', '.choice em blue @ surface', 'blue', 'surface', 4.5],
  ['文字', '.connector-fields button blue @ surface', 'blue', 'surface', 4.5],
  ['文字', '.prompt-box span blue @ surface', 'blue', 'surface', 4.5],
  ['文字', '.task-objective code blue @ 渐变起端', 'blue', { tint: ['blue', .10, 'surface'] }, 4.5],
  ['文字', '.guide-rule-summary>span blue @ color-mix(blue 11%)', 'blue', { tint: ['blue', .11, 'surface'] }, 4.5],
  ['文字', '.build-report-artifact code blue @ surface-2', 'blue', 'surface-2', 4.5],
  ['文字', '.green-text / .mock-row em green @ surface', 'green', 'surface', 4.5],
  ['文字', '.security-chip green @ rgba(green .09)/surface', 'green', { tint: ['green', .09, 'surface'] }, 4.5],
  ['文字', '.build-summary.passed green @ rgba(green .08)/surface-2', 'green', { tint: ['green', .08, 'surface-2'] }, 4.5],
  ['文字', '.guide-step.done .step-number green @ rgba(green .11)/surface', 'green', { tint: ['green', .11, 'surface'] }, 4.5],
  ['文字', '.performance-event .cache-hit green @ surface-2', 'green', 'surface-2', 4.5],
  ['文字', '.build-report-summary.passed green @ surface-2', 'green', 'surface-2', 4.5],
  ['文字', '.danger-button red @ rgba(red .08)/surface', 'red', { tint: ['red', .08, 'surface'] }, 4.5],
  ['文字', '.build-summary.failed red @ rgba(red .08)/surface-2', 'red', { tint: ['red', .08, 'surface-2'] }, 4.5],
  ['文字', '.log-line.error em red @ code', 'red', 'code', 4.5],
  ['文字', '.build-report-summary.failed red @ surface-2', 'red', 'surface-2', 4.5],
  ['文字', '.task-objective p.task-failure red @ 渐变起端', 'red', { tint: ['blue', .10, 'surface'] }, 4.5],
  ['文字', '.log-line.warn em yellow @ code', 'yellow', 'code', 4.5],
  ['文字', '.log-line em green @ code', 'green', 'code', 4.5],
  ['文字', '.log-line time muted-2 @ code', 'muted-2', 'code', 4.5],
  ['文字', '.brand small muted-2 @ sidebar', 'muted-2', 'sidebar', 4.5],
  ['文字', '.sidebar-footer small muted-2 @ sidebar', 'muted-2', 'sidebar', 4.5],
  ['文字', '.status-card p muted-2 @ surface', 'muted-2', 'surface', 4.5],
  ['文字', '.action-list small muted-2 @ surface', 'muted-2', 'surface', 4.5],
  ['文字', '.nav-group-label muted @ sidebar', 'muted', 'sidebar', 4.5],
  ['文字', '.task-muted muted-2 @ surface-2', 'muted-2', 'surface-2', 4.5],
  ['文字', '白字 @ blue-2 填充', 'white', 'blue-2', 4.5],
  // 第 22 轮删除「白字 @ danger-hover」：--danger-hover 随设置窗口栏的
  // `×` 按钮一起移除（该按钮已改为中性的「← 返回主界面」）。
  // 令牌不存在后这条场景会解析到 null 并抛错，故必须同步删掉。
  ['文字', '.primary-button 白字 @ btn-primary-bg', 'white', 'btn-primary-bg', 4.5],
  /* ★ 第 31 轮新增（用户第 3 条「几乎不可见的浅灰占位字」）。
   * 控制台的三类内容各有自己的颜色，必须分别验证 ——
   * 它们在同一个 --console-bg 底上，但明度差很大：
   *   .console-prompt 用 --green（提示符要明显）
   *   正文用 --console-text（日志主体，可读性优先）
   *   钳制范围上 --yellow / --red 也会出现在这里（构建告警与错误行）。
   * 改前这四处都是字面量且与 --console-bg 无关联 —— 脚本看不到，
   * 所以"浅灰字压深底"这种最典型的低对比故障没有护栏。 */
  ['文字', '.build-console 正文 console-text @ console-bg', 'console-text', 'console-bg', 4.5],
  ['文字', '.console-prompt green @ console-bg', 'green', 'console-bg', 4.5],
  ['文字', '.build-console 告警行 yellow @ console-bg', 'yellow', 'console-bg', 4.5],
  ['文字', '.build-console 错误行 red @ console-bg', 'red', 'console-bg', 4.5],
  /* ★ 第 31 轮新增：空闲状态胶囊与构建区块的语义色。
   *   .status-pill i 是**图形**（状态圆点），门槛 3:1。 */
  ['图形', '.status-pill i green @ surface', 'green', 'surface', 3],
  /* ★ 第 31 轮新增：未识别项目的琥珀色标签（用户第 3 条）。
   *   它是文字，压在 color-mix(yellow 10%) 的同色半透明底上 ——
   *   必须按实际合成底色算，否则会高估对比度。 */
  ['文字', '.build-type-badge.unknown yellow @ color-mix(yellow 10%)/surface-2', 'yellow', { tint: ['yellow', .10, 'surface-2'] }, 4.5],
];

/* ---------- 已知例外 ----------
 * 与 stylelint 里 [hidden] 的处理同一思路：**显式放行 + 记录论证**，
 * 而不是把门槛调低到"刚好通过"。
 * 例外必须在下方写清原因，且说明"为什么现在不能修"。
 *
 * 第 27 轮：原先唯一的例外（.progress-track 渐变 blue-2 @ 轨道 surface-3，
 * 深色下 2.39:1）**已修复并移出本清单** ——
 * 渐变起点改用 --blue（对轨道 深色 3.91 / 浅色 4.50），--blue-2 专职做
 * 白字按钮填充（4.77:1）。两个互斥需求各归其位，不再需要拆新令牌。
 * 脚本本身也有 "staleExceptions" 检查：若例外已不再失败会提示删除，
 * 所以这条必须真的移除，不能留着当"永久豁免"。 */
const KNOWN_EXCEPTIONS = [];

/* ---------- 执行 ---------- */
const T = loadTokens(TOKENS);
const rows = [];
for (const t of ['dark', 'light']) {
  const s = T[t];
  for (const [kind, desc, fgTok, bgSpec, need] of SCENARIOS) {
    const fg = s[fgTok];
    let bg;
    if (typeof bgSpec === 'string') bg = s[bgSpec];
    else if (bgSpec && bgSpec.tint) bg = over(LIT[bgSpec.tint[0]], bgSpec.tint[1], s[bgSpec.tint[2]]);
    else bg = bgSpec;
    if (!fg || !bg) { rows.push({ theme: t, kind, desc, fg, bg, r: null, need, ok: false, note: '令牌解析失败' }); continue; }
    const r = ratio(fg, bg);
    rows.push({ theme: t, kind, desc, fg, bg, r, need, ok: r >= need });
  }
}

const fails = rows.filter(x => !x.ok);
/* 已知例外不计入失败，但必须真的命中（防止例外清单变成"永久豁免"的垃圾桶：
 * 若某条例外已不再失败，说明它该被删除，脚本会提示出来）。 */
const isExempt = (x) => KNOWN_EXCEPTIONS.some(e => e.theme === x.theme && e.desc === x.desc);
const exemptHits = fails.filter(isExempt);
const realFails = fails.filter(x => !isExempt(x));
const staleExceptions = KNOWN_EXCEPTIONS.filter(e => !fails.some(f => f.theme === e.theme && f.desc === e.desc));
const jsonMode = process.argv.includes('--json');
const snapMode = process.argv.includes('--snapshot');

if (snapMode) {
  // 快照写到系统临时目录，不污染工作区（它是人工比对产物，不是门禁基准）。
  const snap = path.join(os.tmpdir(), 'gpt-webcodex-contrast-snapshot.json');
  fs.writeFileSync(snap, JSON.stringify({ tokens: T, rows }, null, 2));
  console.log(`已写入快照：${snap}`);
  console.log(`场景数 ${rows.length}，不达标 ${fails.length}`);
  process.exit(0);
}

if (jsonMode) { console.log(JSON.stringify({ total: rows.length, fails: realFails.length, exempt: exemptHits.length, rows: realFails }, null, 2)); process.exit(realFails.length ? 1 : 0); }

let out = '=== 语义色对比度守卫 ===\n';
out += `令牌来源：${path.relative(path.resolve(__dirname, '..'), TOKENS)}\n场景数：${rows.length}（${SCENARIOS.length} × 2 主题）\n\n`;
out += '浅色强调色：' + ['blue', 'green', 'yellow', 'red', 'violet', 'cyan'].map(n => `${n}=${T.light[n]}`).join('  ') + '\n';
out += '深色强调色：' + ['blue', 'green', 'yellow', 'red'].map(n => `${n}=${T.dark[n]}`).join('  ') + '\n\n';
if (realFails.length === 0) {
  out += `✅ 全部达标${exemptHits.length ? `（另有 ${exemptHits.length} 项已知例外，见下）` : ''}\n`;
} else {
  out += `❌ 不达标 ${realFails.length} / ${rows.length} 项：\n`;
  for (const x of realFails) out += `  ✗ [${x.theme}] ${x.kind} ${x.desc}\n        ${x.fg || '?'} on ${x.bg || '?'} = ${x.r === null ? x.note : x.r.toFixed(2)}  (需 ${x.need})\n`;
}
if (exemptHits.length) {
  out += `\n已知例外（放行，不阻塞）：\n`;
  for (const e of KNOWN_EXCEPTIONS) out += `  ○ ${e.desc}\n      ${e.reason}\n`;
}
if (staleExceptions.length) {
  out += `\n⚠ 以下例外已不再不达标，应当从 KNOWN_EXCEPTIONS 删除：\n`;
  for (const e of staleExceptions) out += `  · ${e.desc}\n`;
}
const worst = rows.filter(x => x.r !== null && !isExempt(x)).sort((a, b) => a.r / a.need - b.r / b.need)[0];
out += `\n最紧场景：${worst.desc}  ${worst.r.toFixed(2)}/${worst.need}（余量 ${(worst.r / worst.need).toFixed(3)}×）\n`;

// 在 Windows GUI 下 stdout 可能被吞，额外写一份到临时目录（CI 里 stdout 走管道，不受影响）。
if (!process.env.CI) {
  try { fs.writeFileSync(path.join(os.tmpdir(), 'gpt-webcodex-contrast-report.txt'), out); } catch { /* 写不了就算了，不阻塞 */ }
}
console.log(out);
process.exit(realFails.length ? 1 : 0);