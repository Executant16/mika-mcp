const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const PNG_PATH = path.join(ROOT, 'electron', 'app-icon.png');
const ICO_PATH = path.join(ROOT, 'electron', 'app-icon.ico');

if (fs.existsSync(ICO_PATH) && fs.statSync(ICO_PATH).size > 50000) {
  console.log('generated electron/app-icon.png and electron/app-icon.ico (preserved official mascot icon)');
  process.exit(0);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return out;
}

function pngEncode(width, height, rgba) {
  const scan = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    scan[row] = 0;
    rgba.copy(scan, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(scan, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const S = size / 512;
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

  function blend(x, y, color, alpha = 1) {
    if (x < 0 || y < 0 || x >= size || y >= size || alpha <= 0) return;
    const i = (Math.floor(y) * size + Math.floor(x)) * 4;
    const sa = Math.max(0, Math.min(1, alpha * (color[3] ?? 255) / 255));
    const da = px[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    px[i] = clamp((color[0] * sa + px[i] * da * (1 - sa)) / oa);
    px[i + 1] = clamp((color[1] * sa + px[i + 1] * da * (1 - sa)) / oa);
    px[i + 2] = clamp((color[2] * sa + px[i + 2] * da * (1 - sa)) / oa);
    px[i + 3] = clamp(oa * 255);
  }

  function circle(cx, cy, r, color) {
    cx *= S; cy *= S; r *= S;
    const minX = Math.max(0, Math.floor(cx - r - 1));
    const maxX = Math.min(size - 1, Math.ceil(cx + r + 1));
    const minY = Math.max(0, Math.floor(cy - r - 1));
    const maxY = Math.min(size - 1, Math.ceil(cy + r + 1));
    for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      blend(x, y, color, Math.max(0, Math.min(1, r + 0.75 - d)));
    }
  }

  function roundedRect(x, y, w, h, r, color) {
    x *= S; y *= S; w *= S; h *= S; r *= S;
    const x2 = x + w; const y2 = y + h;
    for (let py = Math.max(0, Math.floor(y - 1)); py <= Math.min(size - 1, Math.ceil(y2 + 1)); py += 1) {
      for (let pxX = Math.max(0, Math.floor(x - 1)); pxX <= Math.min(size - 1, Math.ceil(x2 + 1)); pxX += 1) {
        const qx = Math.abs(pxX + 0.5 - (x + w / 2)) - (w / 2 - r);
        const qy = Math.abs(py + 0.5 - (y + h / 2)) - (h / 2 - r);
        const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
        blend(pxX, py, color, Math.max(0, Math.min(1, 0.85 - outside)));
      }
    }
  }

  function line(x1, y1, x2, y2, width, color) {
    x1 *= S; y1 *= S; x2 *= S; y2 *= S; width *= S;
    const vx = x2 - x1; const vy = y2 - y1; const len2 = vx * vx + vy * vy || 1;
    const minX = Math.max(0, Math.floor(Math.min(x1, x2) - width - 2));
    const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + width + 2));
    const minY = Math.max(0, Math.floor(Math.min(y1, y2) - width - 2));
    const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + width + 2));
    for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
      const wx = x + 0.5 - x1; const wy = y + 0.5 - y1;
      const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
      const d = Math.hypot(x + 0.5 - (x1 + t * vx), y + 0.5 - (y1 + t * vy));
      blend(x, y, color, Math.max(0, Math.min(1, width / 2 + 0.8 - d)));
    }
  }

  // ---- 设计说明 ----------------------------------------------------------
  // 原图标堆了四个元素（机器人脸 + 霓虹轨道环 + 节点图 + 地球网格），
  // 缩到 16×16 会糊成一团，且带渐变发光 —— 典型的"AI 生成图标"。
  //
  // 新版只保留一个符号：终端提示符 ›_（白色尖角 + 强调蓝下划线）。
  // 理由：开发工具最通用的语义符号；两条简单笔画，16px 下依然清晰；
  //      与「让网页 AI 操作本机代码」的定位吻合。
  //
  // 规格：深色中性底板 + 两色标记（白 / 强调蓝），无渐变、无发光、无投影。
  // -----------------------------------------------------------------------

  // 深色中性底板（圆角约 22%，接近 Windows/macOS 的应用磁贴比例）
  roundedRect(20, 20, 472, 472, 106, [25, 28, 34, 255]);

  /* ---- 规格（第 30 轮修订，用户第 6 条「图标还是偏移了」）----------------
   * ★ 实测真因不是居中偏了（内容中心与磁贴中心偏移 0.0px），是**内容太小**：
   *   旧值在 512 画布里只画 263 × 238（51% × 47%），放进界面 34px 方块后
   *   内容只占 33%；而同尺寸方块里内容只占三成，读起来就是又小又空。
   *   旧值在磁贴（472）里也只占 55.7%，四周各留 104.5px —— 空得过分。
   *
   * ★ 新值的推导（一条公式，不是试出来的）：
   *   目标 字形占画布 72%（图标设计常规值；Windows 磁贴同类标记普遍 65~75%，
   *   本文件磁贴里字形现占 78%，四周 51.7px）。
   *   把 263 × 238 的**含笔宽包围盒**等比缩放并居中：
   *     scale = 512 × 0.72 / 263 = 1.401673
   *     SW    = 44 × 1.401673 = 61.674      （笔宽随字形一起缩放，
   *                                           所以"笔宽/字宽 = 16.73%"这条观感比例不变）
   *     字形框 = 368.64 × 333.60，居中于 512 → 左右边距 71.68 / 上下 89.20
   *
   * ★ 与界面的关系：renderer/index.html 的三处内联 SVG 是这组坐标按 24/512
   *   换算得到的（24 空间里 stroke-width = 61.674 × 24/512 = 2.89）。
   *   tests/icon-source.test.js 会从下面这两个常量反算并逐字比对界面路径 ——
   *   改这里不改界面、或改界面不改这里，都会红。这就是"同源"的保证。 */
  const SW = 61.674;                // 笔画宽度：512 画布下 61.674，16px 时约 1.93px
  const CHEVRON = [102.517, 120.038, 235.676, 256, 102.517, 391.962];
  const UNDERSCORE = [297.349, 391.962, 409.483, 391.962];

  // 尖角（分两段绘制，再补一个圆点消除接缝）
  line(CHEVRON[0], CHEVRON[1], CHEVRON[2], CHEVRON[3], SW, [255, 255, 255, 255]);
  line(CHEVRON[2], CHEVRON[3], CHEVRON[4], CHEVRON[5], SW, [255, 255, 255, 255]);
  circle(CHEVRON[2], CHEVRON[3], SW / 2, [255, 255, 255, 255]);

  // 下划线（强调蓝，给图标一点身份色）
  line(UNDERSCORE[0], UNDERSCORE[1], UNDERSCORE[2], UNDERSCORE[3], SW, [108, 140, 255, 255]);

  return px;
}

function makePng(size) {
  return pngEncode(size, size, render(size));
}

function makeIco(sizes) {
  const images = sizes.map((size) => ({ size, png: makePng(size) }));
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const p = 6 + index * 16;
    header[p] = size >= 256 ? 0 : size;
    header[p + 1] = size >= 256 ? 0 : size;
    header[p + 2] = 0;
    header[p + 3] = 0;
    header.writeUInt16LE(1, p + 4);
    header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(png.length, p + 8);
    header.writeUInt32LE(offset, p + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((item) => item.png)]);
}

fs.mkdirSync(path.dirname(PNG_PATH), { recursive: true });
fs.writeFileSync(PNG_PATH, makePng(512));
fs.writeFileSync(ICO_PATH, makeIco([16, 24, 32, 48, 64, 128, 256]));
console.log(`generated ${path.relative(ROOT, PNG_PATH)} and ${path.relative(ROOT, ICO_PATH)}`);
