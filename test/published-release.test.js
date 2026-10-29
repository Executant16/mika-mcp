const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { checkPublishedRelease } = require('../scripts/check-published-release.cjs');

function fixture() {
  const exe = Buffer.from('installer fixture');
  const exeName = 'mika-mcp-setup-0.1.5.exe';
  const hash = crypto.createHash('sha512').update(exe).digest('base64');
  const manifest = { version: '0.1.5', path: exeName, sha512: hash,
    files: [{ url: exeName, sha512: hash, size: exe.length }] };
  const buffers = [exe, Buffer.from('blockmap fixture'), Buffer.from(yaml.dump(manifest))];
  const release = { tag_name: 'v0.1.5', draft: false, prerelease: false,
    assets: [exeName, `${exeName}.blockmap`, 'latest.yml'].map((name, i) => ({ name, id: i + 1,
      size: buffers[i].length, state: 'uploaded', digest: `sha256:${crypto.createHash('sha256').update(buffers[i]).digest('hex')}` })) };
  const target = { type: 'commit', sha: 'a'.repeat(40) };
  const calls = [];
  const options = { repository: 'owner/repo', tag: 'v0.1.5', version: '0.1.5', commit: target.sha,
    request: async (url, mode, allowMissing) => {
      calls.push({ url, mode, allowMissing });
      if (url.includes('/releases/tags/')) return release;
      if (url.includes('/git/ref/')) return { object: target };
      if (url.includes('/git/tags/')) return { object: { type: 'commit', sha: options.commit } };
      return buffers[Number(url.split('/').at(-1)) - 1];
    } };
  return { options, release, target, buffers, manifest, calls };
}

test('missing release continues the normal publication path', async () => {
  const f = fixture();
  f.options.request = async (_url, _mode, allowMissing) => { assert.equal(allowMissing, true); return null; };
  assert.equal(await checkPublishedRelease(f.options), false);
});

for (const type of ['commit', 'tag']) {
  test(`complete published release skips publication with a ${type} ref`, async () => {
    const f = fixture();
    if (type === 'tag') { f.target.type = 'tag'; f.target.sha = 'b'.repeat(40); }
    assert.equal(await checkPublishedRelease(f.options), true);
    assert.equal(f.calls.filter((call) => call.mode === 'bytes').length, 3);
  });
}

test('draft, prerelease, wrong version and different source cannot be accepted as already published', async () => {
  for (const field of ['draft', 'prerelease', 'tag_name', 'commit']) {
    const f = fixture();
    if (field === 'commit') f.options.commit = 'c'.repeat(40);
    else f.release[field] = field === 'tag_name' ? 'v0.1.0' : true;
    await assert.rejects(checkPublishedRelease(f.options));
  }
});

test('missing, duplicated and pending assets stop instead of being overwritten', async () => {
  for (const kind of ['missing', 'duplicate', 'pending']) {
    const f = fixture();
    if (kind === 'missing') f.release.assets.pop();
    if (kind === 'duplicate') f.release.assets[2] = f.release.assets[0];
    if (kind === 'pending') f.release.assets[0].state = 'new';
    await assert.rejects(checkPublishedRelease(f.options), /附件/);
  }
});

test('downloaded content must match the recorded digest for every attachment', async () => {
  for (let i = 0; i < 3; i++) {
    const f = fixture();
    f.buffers[i][0] ^= 1;
    await assert.rejects(checkPublishedRelease(f.options), /SHA-256/);
  }
});

test('a correctly downloaded manifest must still describe this installer', async () => {
  const f = fixture();
  f.manifest.version = '0.1.0';
  f.buffers[2] = Buffer.from(yaml.dump(f.manifest));
  f.release.assets[2].size = f.buffers[2].length;
  f.release.assets[2].digest = `sha256:${crypto.createHash('sha256').update(f.buffers[2]).digest('hex')}`;
  await assert.rejects(checkPublishedRelease(f.options), /更新清单/);
});

test('API failures stop the workflow instead of authorizing a new publication', async () => {
  const f = fixture();
  f.options.request = async () => { throw new Error('HTTP 403'); };
  await assert.rejects(checkPublishedRelease(f.options), /HTTP 403/);
});

test('workflow gates building and publishing on the existing-release result', () => {
  const workflow = yaml.load(fs.readFileSync(path.join(__dirname, '../.github/workflows/release.yml'), 'utf8'));
  const steps = workflow.jobs.release.steps;
  const index = steps.findIndex((step) => step.id === 'existing');
  assert.ok(index > steps.findIndex((step) => step.run === 'npm ci'));
  const remaining = steps.slice(index + 1);
  assert.equal(remaining.length, 5);
  for (const step of remaining) assert.equal(step.if, "steps.existing.outputs.published != 'true'");
});
