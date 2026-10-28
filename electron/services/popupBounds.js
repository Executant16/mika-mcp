// Electron screen workArea and BrowserWindow bounds both use logical pixels (DIP).
function fitPopupBounds(preferred, area) {
  for (const rect of [preferred, area]) {
    if (!rect || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key]))
      || rect.width <= 0 || rect.height <= 0) throw new Error('弹窗边界无效。');
  }
  const padding = Math.min(8, Math.floor(Math.min(area.width, area.height) / 4));
  const width = Math.max(1, Math.min(Math.round(preferred.width), area.width - padding * 2));
  const height = Math.max(1, Math.min(Math.round(preferred.height), area.height - padding * 2));
  return {
    x: Math.max(area.x + padding, Math.min(Math.round(preferred.x), area.x + area.width - padding - width)),
    y: Math.max(area.y + padding, Math.min(Math.round(preferred.y), area.y + area.height - padding - height)),
    width, height
  };
}
module.exports = { fitPopupBounds };
