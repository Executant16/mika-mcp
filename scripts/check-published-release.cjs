const fs = require('node:fs');
const crypto = require('node:crypto');

async function checkPublishedRelease({ repository, tag, commit, version, request }) {
  if (tag !== `v${version}`) throw new Error('发布标签与版本不一致');
  const api = `https://api.github.com/repos/${repository}`;
  const release = await request(`${api}/releases/tags/${encodeURIComponent(tag)}`, 'json', true);
  if (release === null) return false;
  if (release.draft || release.prerelease || release.tag_name !== tag) {
    throw new Error('已有发行版不是预期的正式版，停止自动发布');
  }
  const ref = await request(`${api}/git/ref/tags/${encodeURIComponent(tag)}`, 'json');
  let target = ref.object;
  if (target.type === 'tag') target = (await request(`${api}/git/tags/${target.sha}`, 'json')).object;
  if (target.type !== 'commit' || target.sha !== commit) throw new Error('已有版本标签指向不同源码');

  const exeName = `mika-mcp-setup-${version}.exe`;
  const names = [exeName, `${exeName}.blockmap`, 'latest.yml'];
  if (!Array.isArray(release.assets) || release.assets.length !== names.length) throw new Error('已有发行版附件不完整或含有非预期附件');
  const data = {};
  for (const name of names) {
    const matches = release.assets.filter((asset) => asset.name === name);
    if (matches.length !== 1) throw new Error(`已有发行版缺少唯一附件：${name}`);
    const asset = matches[0];
    if (asset.state !== 'uploaded' || !Number.isSafeInteger(asset.id) || asset.id <= 0 || !Number.isSafeInteger(asset.size) || asset.size <= 0) {
      throw new Error(`附件状态无效：${name}`);
    }
    const bytes = await request(`${api}/releases/assets/${asset.id}`, 'bytes');
    const digest = `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
    if (bytes.length !== asset.size || digest !== asset.digest) throw new Error(`远端附件大小或 SHA-256 不一致：${name}`);
    data[name] = bytes;
  }
  const yaml = require('js-yaml');
  const manifest = yaml.load(data['latest.yml'].toString('utf8'));
  const sha512 = crypto.createHash('sha512').update(data[exeName]).digest('base64');
  if (!manifest || manifest.version !== version || manifest.path !== exeName || manifest.sha512 !== sha512 ||
      !Array.isArray(manifest.files) || manifest.files.length !== 1 || manifest.files[0].url !== exeName ||
      manifest.files[0].sha512 !== sha512 || manifest.files[0].size !== data[exeName].length) {
    throw new Error('已发布更新清单与安装包不一致');
  }
  return true;
}

async function main() {
  const { version } = require('../package.json');
  const repository = process.env.GITHUB_REPOSITORY;
  const commit = process.env.GITHUB_SHA;
  const token = process.env.GH_TOKEN;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !/^[a-f0-9]{40}$/.test(commit || '') || !token) {
    throw new Error('缺少有效的 GitHub 仓库、提交或认证信息');
  }
  const request = async (url, mode, allowMissing = false) => {
    const response = await fetch(url, { headers: {
      Authorization: `Bearer ${token}`,
      Accept: mode === 'bytes' ? 'application/octet-stream' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Mika-release-check'
    } });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub 发布检查失败：HTTP ${response.status}`);
    return mode === 'bytes' ? Buffer.from(await response.arrayBuffer()) : response.json();
  };
  const published = await checkPublishedRelease({ repository, tag: process.env.RELEASE_TAG, commit, version, request });
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `published=${published}\n`);
  console.log(published ? '同标签正式版、源码标签与三项附件核验通过，跳过重复构建和发布。' : '该标签尚无发行版，继续正常构建和发布。');
}

module.exports = { checkPublishedRelease };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
