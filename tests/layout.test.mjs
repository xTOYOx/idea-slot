import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reelRects, stopRect } from '../src/layout.js';
test('3 reels match mockup', () => assert.deepEqual(reelRects(3), [{ x: 33, w: 40 }, { x: 80, w: 40 }, { x: 127, w: 40 }]));
test('2 and 4 reels fit inside 33..167 with gap 7', () => {
  for (const n of [2, 4]) {
    const r = reelRects(n);
    assert.equal(r.length, n);
    assert.ok(r[0].x >= 33 && r.at(-1).x + r.at(-1).w <= 167);
    for (let i = 1; i < n; i++) assert.equal(r[i].x - (r[i - 1].x + r[i - 1].w), 7);
  }
});
test('stopRect centered, max 28', () => {
  assert.deepEqual(stopRect({ x: 33, w: 40 }), { x: 39, w: 28 });
  assert.deepEqual(stopRect({ x: 33, w: 28 }), { x: 33, w: 28 });
});
