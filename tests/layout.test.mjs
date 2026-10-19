import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reelRects, stopRect, cabinetWidth } from '../src/layout.js';
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
test('W=200 is the default and gives the same result', () => {
  for (const n of [2, 3, 4]) assert.deepEqual(reelRects(n, 200), reelRects(n));
  assert.deepEqual(stopRect({ x: 33, w: 40 }, 200), { x: 39, w: 28 });
});
test('W=300: 4 windows span 33..267 with equal gaps, centered', () => {
  assert.deepEqual(reelRects(4, 300), [{ x: 33, w: 53 }, { x: 93, w: 53 }, { x: 153, w: 53 }, { x: 213, w: 53 }]);
  for (const n of [2, 3, 4]) {
    const r = reelRects(n, 300);
    assert.ok(r[0].x >= 33 && r.at(-1).x + r.at(-1).w <= 267);
    for (let i = 1; i < n; i++) assert.equal(r[i].x - (r[i - 1].x + r[i - 1].w), 7);
    assert.ok(Math.abs(r[0].x - 33 - (267 - r.at(-1).x - r.at(-1).w)) <= 1);
  }
});
test('stopRect widens with W (max 40, never wider than the window)', () => {
  assert.deepEqual(stopRect({ x: 33, w: 53 }, 300), { x: 33 + 6, w: 40 });
  assert.equal(stopRect({ x: 0, w: 53 }, 240).w, 33);
  assert.equal(stopRect({ x: 0, w: 30 }, 340).w, 30);
});
test('cabinetWidth: ratio of usable area x 190, clamped 200..340, phones fixed at 200', () => {
  assert.equal(cabinetWidth(375, 812, 0), 200);
  assert.equal(cabinetWidth(599, 300, 44), 200);
  assert.equal(cabinetWidth(900, 700, 44), 222);
  assert.equal(cabinetWidth(1280, 800, 44), 287);
  assert.equal(cabinetWidth(1920, 1080, 44), 326);
  assert.equal(cabinetWidth(2560, 1080, 44), 340);
  assert.equal(cabinetWidth(800, 1000, 44), 200);
  assert.equal(cabinetWidth(1280, 800, 60), 279); // wider tabs leave less room
});
