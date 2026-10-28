const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const tag = process.env.RELEASE_TAG;
if (!/^\d+\.\d+\.\d+$/.test(pkg.version) || tag !== `v${pkg.version}`) {
  throw new Error(`发布标签必须与正式版本一致：期望 v${pkg.version}，实际 ${tag}`);
}
if (lock.version !== pkg.version || lock.packages[''].version !== pkg.version) {
  throw new Error('package.json 与 package-lock.json 版本不一致');
}

const mode = process.argv[2];
if (mode === 'assets') {
  // electron-builder 的构建依赖已包含 js-yaml。
  const yaml = require('js-yaml');
  const manifest = yaml.load(fs.readFileSync(path.join(root, 'dist/latest.yml'), 'utf8'));
  const name = `mika-mcp-setup-${pkg.version}.exe`;
  const exe = fs.readFileSync(path.join(root, 'dist', name));
  const hash = crypto.createHash('sha512').update(exe).digest('base64');
  const files = manifest.files;
  if (manifest.version !== pkg.version || manifest.path !== name || manifest.sha512 !== hash ||
      !Array.isArray(files) || files.length !== 1 || files[0].url !== name ||
      files[0].sha512 !== hash || files[0].size !== exe.length) {
    throw new Error('latest.yml 的版本、文件名、大小或 SHA-512 与安装包不一致');
  }
  if (fs.statSync(path.join(root, 'dist', `${name}.blockmap`)).size === 0) {
    throw new Error('blockmap 为空');
  }
  console.log(`发布产物校验通过：${name}（${exe.length} bytes）`);
} else if (mode !== 'version') {
  throw new Error('用法：check-release.cjs version|assets');
}
console.log(`发布版本校验通过：${tag}`);
