const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
const fallback = source.match(/const FALLBACK_HEALTH_GROUPS = \[[\s\S]*?\n\];/)?.[0];
const helper = source.match(/function orderHealthChecks\(report\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(fallback && helper, '健康检查应有分组兜底和排序函数');
const order = vm.runInNewContext(`${fallback}\n(${helper})`);

test('health checks follow backend group order while retaining ungrouped checks', () => {
  const report = {
    groups: [{ id: 'tunnel' }, { id: 'mcp' }],
    checks: [
      { id: 'mcp', group: 'mcp', ok: false },
      { id: 'tunnel-id', group: 'tunnel', ok: false },
      { id: 'future-check', group: 'future', ok: false },
      { id: 'tunnel-client', group: 'tunnel', ok: false },
      { id: 'no-group', ok: true }
    ]
  };
  const before = structuredClone(report);
  const result = order(report);
  assert.deepEqual(Array.from(result, item => item.id),
    ['tunnel-id', 'tunnel-client', 'mcp', 'future-check', 'no-group']);
  assert.equal(result.length, report.checks.length);
  assert.ok(result.every(item => report.checks.includes(item)));
  assert.deepEqual(report, before, '排序不能改变后端权威报告');
});

test('health checks fall back to known groups without dropping duplicate IDs', () => {
  const checks = [
    { id: 'tunnel', group: 'tunnel', ok: true },
    { id: 'workspace', group: 'workspace', ok: true },
    { id: 'tunnel', group: 'tunnel', ok: false }
  ];
  const result = order({ groups: [], checks });
  assert.deepEqual(Array.from(result, item => checks.indexOf(item)), [1, 0, 2]);
});

test('health check ordering tolerates a missing report', () => {
  assert.equal(order(undefined).length, 0);
});
