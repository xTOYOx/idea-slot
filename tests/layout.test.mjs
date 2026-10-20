import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maxReels, reelRects, stopRect, cabinetWidth, fitWidth, effectiveWidth, widthAt, leverAmount, LEVER_PULL } from '../src/layout.js';
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
test('fitWidth: biggest W that fits the usable area (rounded like cabinetWidth, so auto never exceeds it; at least 200)', () => {
  assert.equal(fitWidth(1280, 800, 44), 287); // 1160 / 768 x 190 = 286.97
  assert.equal(fitWidth(1920, 1080, 44), 326);
  assert.equal(fitWidth(2560, 1080, 44), 442); // may exceed 340
  assert.equal(fitWidth(800, 1000, 44), 200);
  assert.equal(fitWidth(100, 100, 44), 200); // no usable area
});
test('effectiveWidth: auto keeps cabinetWidth, manual is used as is within 200..fitWidth, phones fixed at 200', () => {
  for (const [vw, vh, tab] of [[1280, 800, 44], [2560, 1080, 44], [900, 700, 44], [375, 812, 0]]) assert.equal(effectiveWidth(vw, vh, tab, null), cabinetWidth(vw, vh, tab));
  assert.equal(effectiveWidth(1280, 800, 44, 250), 250);
  assert.equal(effectiveWidth(2560, 1080, 44, 400), 400); // manual may pass 340
  assert.equal(effectiveWidth(1280, 800, 44, 400), 287); // cut to what fits
  assert.equal(effectiveWidth(1280, 800, 44, 150), 200);
  assert.equal(effectiveWidth(375, 812, 0, 300), 200);
  assert.equal(effectiveWidth(599, 300, 44, 300), 200);
});
test('widthAt: displayed width (px) to logical W with the usable height', () => {
  assert.equal(widthAt(768, 800), 190);
  assert.equal(widthAt(1000, 800), 247);
  assert.equal(widthAt(0, 800), 0);
});
test('leverAmount: follows the drag down, clamped to 0..1', () => {
  assert.equal(leverAmount(-10, 100), 0);
  assert.equal(leverAmount(25, 100), 0.25);
  assert.equal(leverAmount(400, 100), 1);
  assert.equal(leverAmount(5, 0), 0);
  assert.ok(LEVER_PULL >= 0.6 && LEVER_PULL < 1);
});

test('maxReels: phones held upright get 4 reels, landscape and PC get 7', () => {
  assert.equal(maxReels(375), 4);
  assert.equal(maxReels(599), 4);
  assert.equal(maxReels(600), 7);
  assert.equal(maxReels(1920), 7);
});
