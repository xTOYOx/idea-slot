import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_H, PER_HIT, colsFor, dropCoin, initialPile, fitPile, frameScale, stepCoin } from '../src/coins.js';

const seeded = (s = 1) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const smooth = h => h.every((v, i) => i === 0 || Math.abs(v - h[i - 1]) <= 1);

test('colsFor: 4px columns', () => assert.equal(colsFor(128), 32));

test('dropCoin: stacks on a flat floor', () => {
  const h = [0, 0, 0];
  assert.equal(dropCoin(h, 1), 1);
  assert.deepEqual(h, [0, 1, 0]);
});
test('dropCoin: rolls to the lower neighbour rather than making a step of 2', () => {
  const h = [0, 1, 1];
  assert.equal(dropCoin(h, 1), 0);
  assert.deepEqual(h, [1, 1, 1]);
  const g = [1, 1, 0];
  assert.equal(dropCoin(g, 1), 2);
  assert.deepEqual(g, [1, 1, 1]);
});
test('dropCoin: tie between two lower neighbours is decided by rnd', () => {
  const a = [0, 1, 0], b = [0, 1, 0];
  assert.equal(dropCoin(a, 1, () => 0.1), 0);
  assert.equal(dropCoin(b, 1, () => 0.9), 2);
});
test('dropCoin: a full pile ignores more coins', () => {
  const h = Array(6).fill(MAX_H);
  assert.equal(dropCoin(h, 3), -1);
  assert.deepEqual(h, Array(6).fill(MAX_H));
});
test('dropCoin: the heap stays smooth and under the cap however many fall', () => {
  const rnd = seeded(7), h = Array(32).fill(0);
  for (let i = 0; i < 3000; i++) { dropCoin(h, 10 + (rnd() * 12 | 0), rnd); assert.ok(smooth(h)); }
  assert.ok(Math.max(...h) <= MAX_H);
  assert.equal(Math.max(...h), MAX_H); // 上限まで積もる
});

test('initialPile: no hits means an empty tray', () => assert.deepEqual(initialPile(32, 0, seeded()), Array(32).fill(0)));
test('initialPile: grows with hits, smooth, capped', () => {
  const sum = n => initialPile(32, n, seeded(3)).reduce((a, b) => a + b, 0);
  assert.equal(sum(1), PER_HIT);
  assert.ok(sum(3) > sum(1) && sum(8) > sum(3));
  const full = initialPile(32, 999, seeded(3));
  assert.ok(smooth(full) && Math.max(...full) === MAX_H);
});

test('fitPile: resamples to the new column count and stays smooth', () => {
  const h = initialPile(32, 12, seeded(5));
  for (const n of [20, 32, 67]) {
    const r = fitPile(h, n);
    assert.equal(r.length, n);
    assert.ok(smooth(r) && Math.max(...r) <= MAX_H);
  }
  assert.deepEqual(fitPile(h, 32), h);
});

test('frameScale: 60fps is 1, 120fps is half, long gaps are capped', () => {
  assert.ok(Math.abs(frameScale(1000 / 60) - 1) < 1e-9);
  assert.ok(Math.abs(frameScale(1000 / 120) - 0.5) < 1e-9);
  assert.equal(frameScale(5000), frameScale(50));
  assert.equal(frameScale(-3), 0);
});
test('stepCoin: the fall is the same at 60Hz and 120Hz', () => {
  const a = { x: 0, y: 0, vx: 1, vy: -2 }, b = { ...a };
  for (let i = 0; i < 30; i++) stepCoin(a, 1);
  for (let i = 0; i < 60; i++) stepCoin(b, 0.5);
  for (const k of ['x', 'y', 'vy']) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, k);
});
