const { app, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.whenReady().then(() => {
  try {
    const ROOT = path.resolve(__dirname, '..');
    const mascotPath = path.join(ROOT, 'renderer', 'mascot.jpg');
    if (!fs.existsSync(mascotPath)) {
      console.error('未找到原图：', mascotPath);
      app.exit(1);
      return;
    }

    const rawImg = nativeImage.createFromPath(mascotPath);
    if (rawImg.isEmpty()) {
      console.error('无法读取图片内容');
      app.exit(1);
      return;
    }

    const origSize = rawImg.getSize();
    // 稍作微调裁剪（去边缘多余黑边，让 Mika 头像更饱满居中）
    const cropW = Math.round(origSize.width * 0.92);
    const cropH = Math.round(origSize.height * 0.92);
    const cropX = Math.round(origSize.width * 0.02);
    const cropY = Math.round(origSize.height * 0.05);
    const focusedImg = rawImg.crop({ x: cropX, y: cropY, width: cropW, height: cropH });

    // 方案 A：标准 Fluent Squircle 平滑抗锯齿圆角（半径比率 22%）
    const makeSquirclePng = (size) => {
      const resized = focusedImg.resize({ width: size, height: size, quality: 'best' });
      const bmp = Buffer.from(resized.toBitmap());
      const radius = size * 0.22;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const qx = Math.abs(x + 0.5 - size / 2) - (size / 2 - radius);
          const qy = Math.abs(y + 0.5 - size / 2) - (size / 2 - radius);
          if (qx > 0 && qy > 0) {
            const dist = Math.hypot(qx, qy) - radius;
            const idx = (y * size + x) * 4;
            if (dist > 1.0) {
              bmp[idx + 3] = 0; // 完全透明
            } else if (dist > 0.0) {
              // 亚像素平滑边缘抗锯齿
              bmp[idx + 3] = Math.round(bmp[idx + 3] * (1.0 - dist));
            }
          }
        }
      }
      return nativeImage.createFromBitmap(bmp, { width: size, height: size }).toPNG();
    };

    const pngPath = path.join(ROOT, 'electron', 'app-icon.png');
    const icoPath = path.join(ROOT, 'electron', 'app-icon.ico');

    // 生成 512x512 高清大图 PNG
    const fullPng = makeSquirclePng(512);
    fs.writeFileSync(pngPath, fullPng);

    // 生成覆盖 16 到 256 全尺寸的 Windows ICO
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const images = sizes.map((size) => ({ size, png: makeSquirclePng(size) }));
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
    const icoBuf = Buffer.concat([header, ...images.map((item) => item.png)]);
    fs.writeFileSync(icoPath, icoBuf);

    console.log(`成功生成 Fluent 22% Squircle 圆角图标：
  - PNG: ${pngPath} (${fullPng.length} bytes)
  - ICO: ${icoPath} (${icoBuf.length} bytes, 包含 7 档全尺寸)`);
    app.exit(0);
  } catch (err) {
    console.error('生成图标失败：', err);
    app.exit(1);
  }
});
