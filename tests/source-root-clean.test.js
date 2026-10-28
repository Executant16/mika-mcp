const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const fixtureParent = path.join(projectRoot, 'tmp', 'source-root-clean');
const sourceScript = path.join(projectRoot, 'scripts', 'check-source-root-clean.js');

function createFixture() {
  fs.mkdirSync(fixtureParent, { recursive: true });
  const root = fs.mkdtempSync(path.join(fixtureParent, 'fixture-'));
  const scriptsDirectory = path.join(root, 'scripts');
  fs.mkdirSync(scriptsDirectory);
  const script = path.join(scriptsDirectory, 'check-source-root-clean.js');
  fs.copyFileSync(sourceScript, script);
  return { root, script };
}

function runCheck(fixture, cwd = fixture.root) {
  return spawnSync(process.execPath, [fixture.script], {
    cwd,
    encoding: 'utf8'
  });
}

test('accepts a clean source root', () => {
  const fixture = createFixture();
  const result = runCheck(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /source root clean/);
});

test('rejects a nested %SystemDrive% directory without deleting its canary', () => {
  const fixture = createFixture();
  const canary = path.join(fixture.root, '%SystemDrive%', 'canary.txt');
  fs.mkdirSync(path.dirname(canary));
  fs.writeFileSync(canary, 'preserve this file');

  const result = runCheck(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /%SystemDrive%/);
  assert.match(result.stderr, /不会删除任何内容/);
  assert.equal(fs.readFileSync(canary, 'utf8'), 'preserve this file');
});

test('rejects a literal %SystemDrive% file', () => {
  const fixture = createFixture();
  fs.writeFileSync(path.join(fixture.root, '%SystemDrive%'), 'preserve this file');

  const result = runCheck(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /%SystemDrive%/);
  assert.match(result.stderr, /不会删除任何内容/);
  assert.equal(fs.readFileSync(path.join(fixture.root, '%SystemDrive%'), 'utf8'), 'preserve this file');
});

test('rejects each previously listed shell-artifact name', async (t) => {
  for (const name of ['browser.css', 'chatViewController.js', "x[1]).join('", '{', '{{']) {
    await t.test(name, () => {
      const fixture = createFixture();
      fs.writeFileSync(path.join(fixture.root, name), 'preserve this file');

      const result = runCheck(fixture);

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes(name));
      assert.match(result.stderr, /不会删除任何内容/);
      assert.equal(fs.readFileSync(path.join(fixture.root, name), 'utf8'), 'preserve this file');
    });
  }
});

test('checks the script directory even when launched from another working directory', () => {
  const fixture = createFixture();
  const otherWorkingDirectory = path.join(fixture.root, 'other-working-directory');
  fs.mkdirSync(otherWorkingDirectory);
  fs.writeFileSync(path.join(fixture.root, 'browser.css'), 'preserve this file');

  const result = runCheck(fixture, otherWorkingDirectory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /browser\.css/);
  assert.equal(fs.readFileSync(path.join(fixture.root, 'browser.css'), 'utf8'), 'preserve this file');
});
