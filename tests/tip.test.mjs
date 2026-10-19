import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeTip } from '../src/tip.js';

const vp = { w: 800, h: 600 }, size = { w: 100, h: 50 };
const rect = (left, top, w = 100, h = 30) => ({ left, top, right: left + w, bottom: top + h });
const inside = (p, s = size) => p.left >= 0 && p.top >= 0 && p.left + s.w <= vp.w && p.top + s.h <= vp.h;

test('placeTip: centred under the anchor when there is room', () => {
  assert.deepEqual(placeTip(rect(100, 100), size, vp), { left: 100, top: 138 });
});
test('placeTip: pushed in from the left and right edges', () => {
  assert.equal(placeTip(rect(0, 100, 20), size, vp).left, 8);
  assert.equal(placeTip(rect(790, 100, 10), size, vp).left, 800 - 100 - 8);
});
test('placeTip: goes above the anchor when it does not fit below', () => {
  const p = placeTip(rect(300, 560), size, vp);
  assert.equal(p.top, 560 - 8 - 50);
  assert.ok(inside(p));
});
test('placeTip: always inside the screen, even for a tall bubble or one wider than the screen', () => {
  const tall = { w: 300, h: 560 }, wide = { w: 900, h: 40 };
  for (const [r, s] of [[rect(400, 280), tall], [rect(10, 10), tall], [rect(700, 570), tall], [rect(50, 50), wide]]) {
    const p = placeTip(r, s, vp);
    assert.ok(p.top >= 0 && p.top + s.h <= vp.h && p.left >= 0, JSON.stringify(p));
    if (s.w <= vp.w) assert.ok(p.left + s.w <= vp.w);
  }
});
