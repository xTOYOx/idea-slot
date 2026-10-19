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

// ---- 払い出しのコインの物理 ----
import { launchCoin, hitCoin, spinCoin, isGone } from '../src/coins.js';

// 受け皿: 左右の壁(l, r)、空の山での着地 y(floor)、1枚ぶんの高さ(step)、壁に当たる高さの下限(rim)、筐体の下端(bottom)
const TRAY = { l: 33, r: 163, floor: 178, step: 2, rim: 176, bottom: 190 };
const flat = () => Array(32).fill(0);
const fly = (p, pile, tray = TRAY, s = 1, rnd = seeded(2), max = 4000) => {
  let t = 0, bounces = 0, vy0 = p.vy;
  for (let i = 0; i < max; i++) {
    stepCoin(p, s); t += s;
    const r = hitCoin(p, pile, tray, rnd);
    if (p.vy < 0 && vy0 > 0) bounces++;
    vy0 = p.vy;
    if (r === 'settled') return { end: 'settled', t, x: p.x, bounces };
    if (isGone(p, tray)) return { end: p.out ? 'out' : 'gone', t, x: p.x, bounces };
  }
  throw new Error('never ended');
};

test('launchCoin: bursts upward like a fountain, left and right both, peaks below the reel windows', () => {
  const rnd = seeded(11), vs = Array.from({ length: 400 }, () => launchCoin(rnd, 100, 165));
  assert.ok(vs.every(p => p.x === 100 && p.y === 165 && !p.out));
  assert.ok(vs.filter(p => p.vy < -1.5).length > 400 * 0.8, 'mostly upward');
  assert.ok(vs.every(p => (p.vy * p.vy) / (2 * 0.18) <= 34), 'the highest coin stays below the reel windows (about 34px up)');
  assert.ok(vs.some(p => p.vx < -2) && vs.some(p => p.vx > 2), 'scatter left and right');
  assert.ok(new Set(vs.map(p => p.vx)).size > 300, 'varied');
  assert.deepEqual(launchCoin(seeded(5), 1, 2), launchCoin(seeded(5), 1, 2), 'same rnd, same coin');
  assert.ok(vs.every(p => p.e >= 0.3 && p.e <= 0.5), 'bounce 0.3-0.5');
});

test('hitCoin: lands on the floor, bounces with less speed, loses sideways speed', () => {
  const p = { x: 60, y: 177, vx: 2, vy: 3, e: 0.4, f: 0 };
  stepCoin(p, 1);
  assert.equal(hitCoin(p, flat(), TRAY), undefined);
  assert.equal(p.y, TRAY.floor);
  assert.ok(p.vy < 0 && p.vy > -3 * 0.5 - 1e-9, 'rebounds');
  assert.ok(p.vx > 0 && p.vx < 2, 'friction');
});
test('hitCoin: lands on the top of the heap, not the floor', () => {
  const pile = flat(); pile[15] = 3;
  const p = { x: 15 * 4 + 35 - 2, y: 160, vx: 0, vy: 3, e: 0.4, f: 0 }; // 列 15 の真上
  for (let i = 0; i < 30 && p.vy > 0; i++) { stepCoin(p, 1); hitCoin(p, pile, TRAY); }
  assert.equal(p.y, TRAY.floor - 3 * TRAY.step);
  assert.ok(p.vy < 0);
});
test('hitCoin: a soft landing settles into the pile column', () => {
  const pile = flat(), p = { x: 35 + 4 * 10 - 2, y: 177.9, vx: 0.2, vy: 0.1, e: 0.4, f: 0 };
  stepCoin(p, 1);
  assert.equal(hitCoin(p, pile, TRAY), 'settled');
  assert.equal(pile.reduce((a, b) => a + b, 0), 1);
  assert.equal(pile[10], 1);
});
test('hitCoin: a full pile spills the coin over the edge instead of deleting it', () => {
  const pile = Array(32).fill(MAX_H), p = { x: 35 + 4 * 6 - 2, y: 150, vx: 0, vy: 0.3, e: 0.4, f: 0 };
  for (let i = 0; i < 100 && !p.out; i++) { stepCoin(p, 1); const r = hitCoin(p, pile, TRAY); if (r === 'spill') assert.ok(p.out && p.vy < 0 && p.vx < 0, 'toward the nearer (left) edge'); }
  assert.ok(p.out);
  assert.deepEqual(pile, Array(32).fill(MAX_H));
  for (let i = 0; i < 300 && !isGone(p, TRAY); i++) { stepCoin(p, 1); assert.equal(hitCoin(p, pile, TRAY), undefined); }
  assert.ok(isGone(p, TRAY), 'falls out of the cabinet');
});
test('hitCoin: a low coin bounces back off the side wall', () => {
  const p = { x: 34, y: 177, vx: -2, vy: 0, e: 0.5, f: 0 };
  stepCoin(p, 1); stepCoin(p, 1);
  hitCoin(p, flat(), TRAY);
  assert.ok(p.vx > 0 && p.vx < 2 && p.x >= TRAY.l && !p.out);
  const q = { x: 140, y: 177, vx: 2, vy: 0, e: 0.5, f: 0 };
  for (let i = 0; i < 20; i++) { stepCoin(q, 1); hitCoin(q, flat(), TRAY); }
  assert.ok(q.vx < 2 && q.x + 4 <= TRAY.r + 1e-9);
});
test('hitCoin: a high coin goes over the rim and then falls outside without being caught', () => {
  const p = { x: 50, y: 150, vx: -3, vy: -1, e: 0.4, f: 0 };
  let r;
  for (let i = 0; i < 60 && !p.out; i++) { stepCoin(p, 1); r = hitCoin(p, flat(), TRAY); }
  assert.ok(p.out && r === undefined && p.x < TRAY.l);
  for (let i = 0; i < 400 && !isGone(p, TRAY); i++) { stepCoin(p, 1); hitCoin(p, flat(), TRAY); assert.ok(p.vx < 0, 'not reflected'); }
  assert.ok(isGone(p, TRAY));
  assert.ok(!isGone({ x: 100, y: 189, out: false }, TRAY) && isGone({ x: 100, y: 191, out: false }, TRAY));
});
test('hitCoin: bounces a few times, then settles', () => {
  const rnd = seeded(4);
  let n = 0, tot = 0;
  for (let i = 0; i < 100; i++) {
    const p = launchCoin(rnd, 100, 165), r = fly(p, flat(), TRAY, 1, rnd);
    if (r.end === 'settled') { n++; tot += r.bounces; assert.ok(r.bounces <= 6); }
  }
  assert.ok(n > 40 && tot / n >= 1.5, `avg bounces ${tot / n}`);
});
test('hitCoin: about 1 in 5 coins spills when they pay out into an empty tray', () => {
  const rnd = seeded(8);
  let out = 0, total = 0;
  for (let b = 0; b < 10; b++) {
    const pile = flat();
    for (let i = 0; i < 40; i++) { total++; if (fly(launchCoin(rnd, 84 + rnd() * 32, 165), pile, TRAY, 1, rnd).end === 'out') out++; }
  }
  assert.ok(out / total > 0.1 && out / total < 0.35, `spill ${out / total}`);
});
test('hitCoin: 60Hz and 120Hz give nearly the same path and landing', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const a = launchCoin(seeded(seed), 100, 165), b = { ...a };
    const ra = fly(a, flat(), TRAY, 1), rb = fly(b, flat(), TRAY, 0.5);
    assert.equal(ra.end, rb.end, `seed ${seed}`);
    assert.ok(Math.abs(ra.x - rb.x) < 6 && Math.abs(ra.t - rb.t) < 8, `seed ${seed}: ${ra.x} ${rb.x} ${ra.t} ${rb.t}`);
  }
});
test('hitCoin: before the first contact the path is exactly the same at any dt', () => {
  const a = { x: 100, y: 100, vx: 2, vy: -3, e: 0.4, f: 0 }, b = { ...a };
  for (let i = 0; i < 20; i++) { stepCoin(a, 1); hitCoin(a, flat(), TRAY); }
  for (let i = 0; i < 40; i++) { stepCoin(b, 0.5); hitCoin(b, flat(), TRAY); }
  for (const k of ['x', 'y', 'vy']) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, k);
});

test('spinCoin: faster coins spin faster, the same at any dt, still while idle', () => {
  const slow = { vx: 0.2, vy: 0, f: 0 }, fast = { vx: 4, vy: 3, f: 0 }, f2 = { ...fast, f: 0 };
  spinCoin(slow, 1); spinCoin(fast, 1);
  assert.ok(fast.f > slow.f * 2 && slow.f > 0);
  spinCoin(f2, 0.5); spinCoin(f2, 0.5);
  assert.ok(Math.abs(f2.f - fast.f) < 1e-9);
});

test('takeCoins: takes the top coin of the swiped column and its neighbours, the pile stays smooth', async () => {
  const { takeCoins } = await import('../src/coins.js');
  const h = [0, 1, 2, 3, 2, 1, 0];
  const got = takeCoins(h, 3);
  assert.deepEqual(got.map(g => g.col), [2, 3, 4]);
  assert.deepEqual(got.map(g => g.k), [1, 2, 1], 'level of each taken coin (0 = bottom)');
  assert.equal(h.reduce((a, b) => a + b), 9 - 3);
  for (let i = 1; i < h.length; i++) assert.ok(Math.abs(h[i] - h[i - 1]) <= 1, `smooth at ${i}: ${h}`);
  assert.deepEqual(takeCoins([0, 0, 0], 1), [], 'nothing to take');
  assert.deepEqual(takeCoins([2], 5), [], 'outside the pile');
  const tall = [0, 0, 4, 4, 4, 0, 0];
  takeCoins(tall, 3, 0);
  for (let i = 1; i < tall.length; i++) assert.ok(Math.abs(tall[i] - tall[i - 1]) <= 1, `slides down after a pit: ${tall}`);
  assert.equal(tall.reduce((a, b) => a + b), 11);
});
