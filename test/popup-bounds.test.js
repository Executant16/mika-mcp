const test = require('node:test');
const assert = require('node:assert/strict');
const { fitPopupBounds } = require('../electron/services/popupBounds');

test('popup bounds fit small work areas including negative-coordinate monitors', () => {
  for (const area of [
    { x: 0, y: 0, width: 960, height: 480 },
    { x: -1280, y: -200, width: 1280, height: 600 },
    { x: 1920, y: 0, width: 320, height: 300 }
  ]) {
    for (const point of [[area.x - 100, area.y - 100], [area.x + area.width, area.y + area.height], [area.x + 30, area.y + 60]]) {
      for (const [width, height] of [[520, 430], [456, 640]]) {
        const bounds = fitPopupBounds({ x: point[0], y: point[1], width, height }, area);
        assert.ok(bounds.x >= area.x && bounds.y >= area.y);
        assert.ok(bounds.x + bounds.width <= area.x + area.width);
        assert.ok(bounds.y + bounds.height <= area.y + area.height);
        assert.ok(bounds.width > 0 && bounds.height > 0);
      }
    }
  }
});
test('roomy screens keep existing popup position and size', () => {
  const preferred = { x: 150, y: 80, width: 520, height: 430 };
  assert.deepEqual(fitPopupBounds(preferred, { x: 0, y: 0, width: 1920, height: 1040 }), preferred);
});
test('invalid geometry fails instead of guessing a screen', () => {
  assert.throws(() => fitPopupBounds({ x: NaN, y: 0, width: 520, height: 430 }, { x: 0, y: 0, width: 960, height: 480 }), /边界无效/);
});
