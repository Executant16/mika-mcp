const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { acquireProductionLock } = require('../electron/services/dataDirectoryService');

test('instance identity is fixed outside the profile and restores userData even on lock refusal or error', () => {
  const parent = path.resolve(__dirname, '../tmp/production-instance-lock');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'case-'));
  const options = { locatorFile: path.join(root, 'storage/production.json') };
  const lockRoot = path.join(root, 'storage/instance-lock');
  let held = false;
  for (const outcome of [true, false, 'throw']) {
    const original = path.join(root, outcome === true ? 'profile-A' : 'profile-B');
    let current = original;
    const app = {
      getPath: () => current,
      setPath: (name, value) => { assert.equal(name, 'userData'); current = value; },
      requestSingleInstanceLock: () => {
        assert.equal(current, lockRoot);
        assert.ok(fs.statSync(current).isDirectory());
        if (outcome === 'throw') throw new Error('lock failure');
        const acquired = !held;
        held = true;
        return acquired;
      }
    };
    if (outcome === 'throw') assert.throws(() => acquireProductionLock(app, options), /lock failure/);
    else assert.equal(acquireProductionLock(app, options), outcome);
    assert.equal(current, original);
  }
});
