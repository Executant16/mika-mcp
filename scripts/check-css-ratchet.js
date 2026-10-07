#!/usr/bin/env node
'use strict';
/* ============================================================================
 * check-css-ratchet.js —— 样式违规"棘轮"门禁
 * ----------------------------------------------------------------------------
 * 为什么需要它：
 *   stylelint 现有 187 条违规（browser.css 100 + styles.css 87），errored=true。
 *   直接把它作为门禁，CI 会从第一天起就是红的 —— 而永远红的门禁等于没有门禁，
 *   没人会再看它。
 *
 *   所以改成**棘轮**：把当前存量违规数固化为基线，CI 只拦"比基线新增"的。
 *   存量不阻塞，但新代码不能让它变差。等存量清理完，门禁自然升格为 0 容忍。
 *
 * 棘轮而非白名单：
 *   白名单要逐条列出"哪些违规被容忍"，存量 187 条会写成一个巨大的清单，
 *   且每次整改都要手工维护。棘轮只记**归一化提示文本**及其条数，
 *   插行、移动、改值都不会造成假报；只有在真的新增违规时才失败。
 *
 * 判据（两条同时成立才算通过）：
 *   1. 每条「文件 × 规则 × 归一化提示文本」的条数 ≤ 基线
 *   2. 违规总数 ≤ 基线总数
 *
 * 已知盲区（接受，因为代价远小于收益）：
 *   同一文件同一提示下"删一条、加一条"会被计数抵消而漏过。
 *   这要求同时增删，且提示文本完全相同 —— 而提示文本里含具体的
 *   颜色值 / 属性值 / 选择器名，要使两处提示完全一致，两条违规本身
 *   就得几乎一样。在"逐项整改、只减不增"的实际工作流里概率极低。
 *   换来的是零假报，这对"让人愿意长期看这个门禁"更重要。
 *
 * 用法：
 *   node scripts/check-css-ratchet.js            # 检查，新增违规则退出码 1
 *   node scripts/check-css-ratchet.js --update   # 用当前状态重写基线
 *   node scripts/check-css-ratchet.js --json     # 机器可读输出
 * ========================================================================== */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const BASELINE = path.join(root, 'stylelint-baseline.json');

/* ---------- 提示文本归一化 ----------
 * 棘轮以提示文本为判定粒度，前提是**文本必须对"无关编辑"稳定**：
 * 插行、移动、改值都不该改变它，否则会造成假报。
 *
 * 但并非所有规则的 message 都满足这一点。实测 5 类规则里:
 *   color-no-hex            "Disallowed hex color \"#fff\" (color-no-hex)"        稳定
 *   function-disallowed-list "Disallowed function \"rgba\" (...)"                  稳定
 *   declaration-property-... "Disallowed value \"6px\" for property ..."           稳定
 *   selector-max-specificity "Too high specificity in \"...\" (...)"               稳定
 *   no-duplicate-selectors  "Duplicate selector \"button\", **first used at line 15**"  ← 含行号！
 *
 * 漏掉最后一类会怎样：在第 17 轮用棘轮保护第 16 轮成果时，第 10 轮删掉几行
 * 死选择器，行号整体前移，于是四条**原本就存在**的 no-duplicate-selectors
 * 被报成"新增违规" —— 门禁误报，且恰好拦住了正确的改动。
 * 所以这里统一剥掉易变部分。
 *
 * 剥掉行号不损失判定能力：选择器文本本身仍在 message 里，
 * 真新增一条重复选择器照样能被认出来。 */
function normalizeText(text) {
  return String(text)
    // Windows 检出可能把多行选择器改成 CRLF，提示文本也会随之改变。
    .replace(/\r\n?/g, '\n')
    // no-duplicate-selectors: "first used at line 15" —— 行号随无关编辑漂移
    .replace(/first used at line \d+/gi, 'first used at line ?')
    // 兜底：其他规则若把行号写进 message，同样剥掉
    .replace(/\bline \d+/gi, 'line ?');
}

/* ---------- 跑 stylelint ----------
 * 用 API 而不是 CLI：CLI 在 Windows GUI 下 stdout 会被吞掉，
 * 拿不到结构化结果。API 返回对象，结果稳定。 */
async function collect() {
  const stylelint = require('stylelint');
  const raw = await stylelint.lint({ files: 'renderer/**/*.css', cwd: root });
  const counts = {};   // 「文件|规则」 → 条数（用于总数比对）
  const items = {};    // 「文件|规则|归一化提示文本」 → 条数（判定用）
  const spots = {};    // 同上 → [{line,column}...]（报告用行号）
  for (const file of raw.results) {
    const rel = path.relative(root, file.source || '').split(path.sep).join('/');
    for (const w of file.warnings || []) {
      const key = `${rel}|${w.rule}`;
      const item = `${key}|${normalizeText(w.text)}`;
      counts[key] = (counts[key] || 0) + 1;
      items[item] = (items[item] || 0) + 1;
      (spots[item] = spots[item] || []).push({ line: w.line, column: w.column });
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, items, spots, total };
}

/* 把「文件|规则|提示文本」还原成人类可读的一行 */
function describeItem(item, spots, count) {
  const [file, rule, text] = item.split('|');
  const where = (spots || []).slice(0, count).map(s => `${s.line}:${s.column}`).join(', ');
  return `${file}  [${rule}]  ${text}${where ? `  @ ${where}` : ''}`;
}

/* ---------- 主流程 ---------- */
(async () => {
  const jsonMode = process.argv.includes('--json');
  const updateMode = process.argv.includes('--update');

  const cur = await collect();

  if (updateMode) {
    // 只在"违规减少"或基线不存在时允许收紧/重建；增加必须显式知情。
    const prev = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null;
    if (prev && cur.total > prev.total) {
      console.error(`拒绝更新基线：违规数从 ${prev.total} 增到 ${cur.total}。`);
      console.error('基线只能收紧，不能放宽 —— 否则棘轮就失效了。');
      console.error('若确有正当理由收紧规则后新增，请手工编辑 stylelint-baseline.json 并在提交信息中说明。');
      process.exit(1);
    }
    const payload = {
      _comment: '样式违规棘轮基线。由 scripts/check-css-ratchet.js --update 生成。只允许收紧，不允许放宽。',
      total: cur.total,
      counts: cur.counts,
      items: cur.items,
    };
    fs.writeFileSync(BASELINE, JSON.stringify(payload, null, 2) + '\n');
    console.log(`基线已更新：${prev ? prev.total : '(新建)'} → ${cur.total}`);
    process.exit(0);
  }

  if (!fs.existsSync(BASELINE)) {
    console.error(`缺少基线文件 ${path.relative(root, BASELINE)}。`);
    console.error('首次请运行：node scripts/check-css-ratchet.js --update');
    process.exit(1);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const baseItems = base.items || {};

  /* 判定到**提示文本**粒度，而不是「文件 × 规则」计数：
   * 后者会在"删一条旧的、加一条新的"时互相抵消而漏过；
   * 提示文本不含行号，所以插行/移动/改值都不会造成假报。 */
  const added = [];    // 新增（或变多的）提示
  const removed = [];  // 减少（或消失）的提示

  for (const item of new Set([...Object.keys(cur.items), ...Object.keys(baseItems)])) {
    const now = cur.items[item] || 0;
    const was = baseItems[item] || 0;
    if (now > was) added.push({ item, now, was, delta: now - was, spots: cur.spots[item] || [] });
    else if (now < was) removed.push({ item, now, was, delta: now - was });
  }
  added.sort((a, b) => b.delta - a.delta);

  const pass = added.length === 0 && cur.total <= base.total;

  if (jsonMode) {
    console.log(JSON.stringify({
      pass, total: cur.total, baselineTotal: base.total,
      added: added.map(({ item, now, was, delta, spots }) => ({ item, now, was, delta, spots })),
      removed: removed.map(({ item, now, was, delta }) => ({ item, now, was, delta })),
    }, null, 2));
    process.exit(pass ? 0 : 1);
  }

  const lines = [];
  lines.push('=== 样式违规棘轮门禁 ===');
  lines.push(`违规总数：${cur.total}（基线 ${base.total}）`);
  lines.push('');
  if (pass) {
    lines.push(`✅ 通过 —— 未新增违规（基线 ${base.total} → 当前 ${cur.total}）`);
  } else {
    lines.push(`❌ 新增违规（只列新增的，存量见 stylelint-baseline.json）：`);
    for (const a of added) {
      lines.push(`  ✗ ${describeItem(a.item, a.spots, a.now)}${a.was ? `  （${a.was} → ${a.now}）` : ''}`);
    }
    if (cur.total > base.total) lines.push(`  ✗ 总数 ${base.total} → ${cur.total}`);
    lines.push('');
    lines.push('  若这是有意为之：请先修掉，或运行 --update 收紧基线（只允许收紧）。');
  }
  if (removed.length) {
    lines.push('');
    lines.push(`ℹ ${removed.length} 类违规已减少，运行 --update 可收紧基线：`);
    for (const r of removed) lines.push(`  · ${describeItem(r.item, [], 1)}  ${r.was} → ${r.now}`);
  }
  if (cur.total === 0) {
    lines.push('');
    lines.push('🎉 违规已归零 —— 可以把门禁从棘轮升格为 npm run lint:css 直接检查。');
  }
  console.log(lines.join('\n'));
  process.exit(pass ? 0 : 1);
})().catch((error) => {
  console.error(`棘轮检查自身失败：${error && error.stack ? error.stack : error}`);
  process.exit(2);
});
