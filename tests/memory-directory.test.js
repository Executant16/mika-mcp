const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openMemoryDirectory } = require('../electron/services/memoryDirectoryService');

const repositoryRoot = path.resolve(__dirname, '..');
const fixtureParent = path.join(repositoryRoot, 'tmp', 'mika-memory-directory', 'node-fixtures');

function createFixture(name) {
  fs.mkdirSync(fixtureParent, { recursive: true });
  const root = fs.mkdtempSync(path.join(fixtureParent, `${name}-`));
  return { root };
}

function configResult(root) {
  return { ok: true, config: { root } };
}

function runtimeHandlers(result, onOpen = () => '') {
  return {
    readConfig: async () => result,
    openPath: async (root) => onOpen(root)
  };
}

function isWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

test('opens the non-empty Runtime root outside the source workspace', async () => {
  const fixture = createFixture('opens-configured-root');
  const sourceWorkspace = path.join(fixture.root, 'source-workspace');
  const memoryRoot = path.join(fixture.root, 'independent-memory-data', 'memory-v1');
  fs.mkdirSync(sourceWorkspace);
  fs.mkdirSync(memoryRoot, { recursive: true });
  fs.writeFileSync(path.join(memoryRoot, 'memory.md'), '# local memory\n');
  const openedPaths = [];

  const result = await openMemoryDirectory(runtimeHandlers(configResult(memoryRoot), async (root) => {
    openedPaths.push(root);
    await Promise.resolve();
    return '';
  }));

  assert.equal(isWithin(memoryRoot, sourceWorkspace), false);
  assert.deepEqual(openedPaths, [memoryRoot]);
  assert.deepEqual(result, { opened: true, root: memoryRoot });
});

test('rejects an empty Runtime root and a relative root without opening anything', async (t) => {
  for (const root of ['', '   ', 'relative-memory-root']) {
    await t.test(JSON.stringify(root), async () => {
      let openCalled = false;
      await assert.rejects(openMemoryDirectory(runtimeHandlers(configResult(root), () => {
        openCalled = true;
        return '';
      })));
      assert.equal(openCalled, false);
    });
  }
});

test('rejects a Runtime config response that is not successful even if it contains a root', async () => {
  const fixture = createFixture('failed-config-result');
  const memoryRoot = path.join(fixture.root, 'memory-root');
  fs.mkdirSync(memoryRoot);
  fs.writeFileSync(path.join(memoryRoot, 'memory.md'), 'preserve');
  let openCalled = false;

  await assert.rejects(openMemoryDirectory(runtimeHandlers({ ok: false, config: { root: memoryRoot } }, () => {
    openCalled = true;
    return '';
  })));
  assert.equal(openCalled, false);
});

test('rejects a Runtime config read error without opening a path', async () => {
  let openCalled = false;
  await assert.rejects(openMemoryDirectory({
    readConfig: async () => { throw new Error('Runtime unavailable'); },
    openPath: async () => {
      openCalled = true;
      return '';
    }
  }), /Runtime unavailable/);
  assert.equal(openCalled, false);
});

test('rejects a file where the Runtime memory directory is expected', async () => {
  const fixture = createFixture('file-as-memory-root');
  const filePath = path.join(fixture.root, 'not-a-directory');
  fs.writeFileSync(filePath, 'keep this file');
  let openCalled = false;

  await assert.rejects(openMemoryDirectory(runtimeHandlers(configResult(filePath), () => {
    openCalled = true;
    return '';
  })));
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'keep this file');
  assert.equal(openCalled, false);
});

test('rejects a missing memory directory without creating it', async () => {
  const fixture = createFixture('missing-memory-root');
  const memoryRoot = path.join(fixture.root, 'not-created', 'memory-v1');
  let openCalled = false;

  await assert.rejects(openMemoryDirectory(runtimeHandlers(configResult(memoryRoot), () => {
    openCalled = true;
    return '';
  })));
  assert.equal(fs.existsSync(memoryRoot), false);
  assert.equal(fs.existsSync(path.dirname(memoryRoot)), false);
  assert.equal(openCalled, false);
});

test('rejects a directory that contains only hidden entries and __pycache__', async () => {
  const fixture = createFixture('filtered-empty-memory-root');
  const memoryRoot = path.join(fixture.root, 'memory-v1');
  fs.mkdirSync(path.join(memoryRoot, '__pycache__'), { recursive: true });
  fs.writeFileSync(path.join(memoryRoot, '.index-cache'), 'ignore hidden entry');
  fs.writeFileSync(path.join(memoryRoot, '__pycache__', 'memory.pyc'), 'ignore bytecode cache');
  let openCalled = false;

  await assert.rejects(openMemoryDirectory(runtimeHandlers(configResult(memoryRoot), () => {
    openCalled = true;
    return '';
  })), /记忆目录为空/);
  assert.equal(openCalled, false);
});

test('does not treat hidden files or __pycache__ as user memories when deciding whether to open', async () => {
  const fixture = createFixture('visible-memory-entry');
  const memoryRoot = path.join(fixture.root, 'memory-v1');
  fs.mkdirSync(path.join(memoryRoot, '__pycache__'), { recursive: true });
  fs.writeFileSync(path.join(memoryRoot, '.index-cache'), 'ignore hidden entry');
  fs.writeFileSync(path.join(memoryRoot, '__pycache__', 'memory.pyc'), 'ignore bytecode cache');
  fs.writeFileSync(path.join(memoryRoot, 'memory.md'), '# visible memory\n');
  const openedPaths = [];

  const result = await openMemoryDirectory(runtimeHandlers(configResult(memoryRoot), async (root) => {
    openedPaths.push(root);
    return '';
  }));

  assert.deepEqual(openedPaths, [memoryRoot]);
  assert.deepEqual(result, { opened: true, root: memoryRoot });
});

test('rejects a symbolic-link or junction ancestor of the memory root', async (t) => {
  const fixture = createFixture('linked-memory-root-ancestor');
  const targetParent = path.join(fixture.root, 'real-parent');
  const targetRoot = path.join(targetParent, 'memory-v1');
  const linkedParent = path.join(fixture.root, 'linked-parent');
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.writeFileSync(path.join(targetRoot, 'memory.md'), 'keep this memory');
  try {
    fs.symlinkSync(targetParent, linkedParent, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP', 'ENOSYS'].includes(error.code)) {
      t.skip(`this environment cannot create a directory link (${error.code})`);
      return;
    }
    throw error;
  }
  let openCalled = false;

  await assert.rejects(openMemoryDirectory(runtimeHandlers(configResult(path.join(linkedParent, 'memory-v1')), () => {
    openCalled = true;
    return '';
  })));
  assert.equal(fs.readFileSync(path.join(targetRoot, 'memory.md'), 'utf8'), 'keep this memory');
  assert.equal(openCalled, false);
});

test('rejects a non-directory ancestor even when the leaf itself does not exist', async () => {
  const fixture = createFixture('file-ancestor-memory-root');
  const fileAncestor = path.join(fixture.root, 'file-ancestor');
  fs.writeFileSync(fileAncestor, 'keep this file');
  let openCalled = false;

  await assert.rejects(openMemoryDirectory(runtimeHandlers(configResult(path.join(fileAncestor, 'memory-v1')), () => {
    openCalled = true;
    return '';
  })));
  assert.equal(fs.readFileSync(fileAncestor, 'utf8'), 'keep this file');
  assert.equal(openCalled, false);
});

test('throws when Electron returns a non-empty openPath error string', async () => {
  const fixture = createFixture('open-path-error');
  const memoryRoot = path.join(fixture.root, 'memory-v1');
  fs.mkdirSync(memoryRoot);
  fs.writeFileSync(path.join(memoryRoot, 'memory.md'), '# visible memory\n');
  const openedPaths = [];

  await assert.rejects(openMemoryDirectory(runtimeHandlers(configResult(memoryRoot), async (root) => {
    openedPaths.push(root);
    return 'Explorer failed to open';
  })), /Explorer failed to open/);
  assert.deepEqual(openedPaths, [memoryRoot]);
});

test('main opens the Runtime-selected root and the renderer no longer invents a workspace-local path', () => {
  const main = fs.readFileSync(path.join(repositoryRoot, 'electron', 'main.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(repositoryRoot, 'renderer', 'app.js'), 'utf8');

  assert.match(main, /require\('\.\/services\/memoryDirectoryService'\)/);
  assert.match(main, /readConfig:\s*\(\)\s*=>\s*callLocalMcpTool\('memory_control',\s*\{\s*action:\s*'config'\s*\}\)/);
  assert.match(main, /openPath:\s*\(root\)\s*=>\s*shell\.openPath\(root\)/);
  // Storage settings legitimately expose defaultRoot. Only memory rendering
  // must never invent a fallback root; guard both memory rendering functions.
  const directoryStart = renderer.indexOf('function syncMemoryDirectoryVisuals()');
  const directoryEnd = renderer.indexOf('function initMemoryPage()', directoryStart);
  const switchesStart = renderer.indexOf('function renderMemorySwitches()');
  const switchesEnd = renderer.indexOf('function memoryCompactEmptyMarkup(', switchesStart);
  assert.ok(directoryStart >= 0 && directoryEnd > directoryStart);
  assert.ok(switchesStart >= 0 && switchesEnd > switchesStart);
  const memoryRendering = renderer.slice(directoryStart, directoryEnd) + renderer.slice(switchesStart, switchesEnd);
  assert.doesNotMatch(memoryRendering, /defaultRoot/);
  assert.doesNotMatch(renderer, /\.coding-tools[\\/]memory/);
  assert.match(memoryRendering, /config\.root/);
});
