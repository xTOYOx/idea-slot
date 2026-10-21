import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_SCRIPT, DEMO_WORDS, DEMO_TYPES, LEVER_RAMP_MS, SWEEP_MS, TAP_MS, modeOf, sweepAt, startOf } from '../src/demo.js';

test('modeOf: nothing in the URL means nothing changes', () => {
  assert.deepEqual(modeOf(''), { demo: false, loop: false, shot: false });
  assert.deepEqual(modeOf('?sw=1&x=2'), { demo: false, loop: false, shot: false });
});
test('modeOf: ?demo, ?demo&loop, ?shot ("loop" alone does nothing)', () => {
  assert.deepEqual(modeOf('?demo'), { demo: true, loop: false, shot: false });
  assert.deepEqual(modeOf('?demo&loop'), { demo: true, loop: true, shot: false });
  assert.deepEqual(modeOf('?loop'), { demo: false, loop: false, shot: false });
  assert.deepEqual(modeOf('?shot'), { demo: false, loop: false, shot: true });
});

test('script: sorted by time, starts with a reset, ends with end, about 25 seconds in all', () => {
  assert.equal(DEMO_SCRIPT[0].act, 'reset');
  assert.equal(DEMO_SCRIPT.at(-1).act, 'end');
  for (let i = 1; i < DEMO_SCRIPT.length; i++) assert.ok(DEMO_SCRIPT[i].at >= DEMO_SCRIPT[i - 1].at, `step ${i} is out of order`);
  const total = DEMO_SCRIPT.at(-1).at;
  assert.ok(total >= 20000 && total <= 30000, `total ${total}ms`);
});
test('script: spin and stop, LOCK reel 1, spin again, IDEA!, hits drawer, theme panel, then sweep the coins', () => {
  const acts = DEMO_SCRIPT.filter(s => s.act !== 'reset' && s.act !== 'end');
  assert.deepEqual(acts.map(s => s.act + (s.reel ?? '')), ['lever', 'stop0', 'stop1', 'stop2', 'tap', 'lever', 'stop1', 'stop2', 'tap', 'tap', 'tap', 'tap', 'tap', 'tap', 'sweep']);
  assert.deepEqual(acts.filter(s => s.act === 'tap').map(s => s.sel), ['[data-s="0"]', '#idea', '#d-hits .dtab', '#d-hits [data-dclose]', '[data-mon="1"]', '#types [data-ty="extra:yokai"]', '#types [data-close]']);
  const levers = acts.filter(s => s.act === 'lever');
  assert.ok(levers[0].at >= 2000, 'the title has time to show on the idle cabinet');
  assert.ok(levers.every(s => s.words.length === 3 && s.words.every(Boolean)));
  assert.deepEqual(levers.at(-1).words, DEMO_WORDS, 'the last spin lands on the hit');
  assert.equal(levers[0].words[0], DEMO_WORDS[0], 'the locked word stays the same');
  const stops = acts.filter(s => s.act === 'stop');
  assert.ok(stops[0].at >= levers[0].at + LEVER_RAMP_MS + 500, 'a pause between the pull and the first stop');
  assert.ok(stops.every((s, i) => i === 0 || s.at - stops[i - 1].at >= 500), 'reels stop one by one with room between');
  assert.ok(stops.every(s => s.at < DEMO_SCRIPT.at(-1).at));
  const sweep = acts.find(s => s.act === 'sweep');
  assert.ok(DEMO_SCRIPT.at(-1).at - sweep.at >= SWEEP_MS, 'the sweep finishes before the end');
});
test('tap: a finger appears TAP_MS before the press, and every tap starts after the previous act', () => {
  const taps = DEMO_SCRIPT.filter(s => s.act === 'tap');
  assert.ok(taps.every(s => s.sel && startOf(s) === s.at - TAP_MS && startOf(s) >= 0));
  assert.equal(startOf({ at: 1000, act: 'lever' }), 1000);
  const lock = taps[0], second = DEMO_SCRIPT.find(s => s.act === 'lever' && s.at > lock.at);
  assert.ok(second.at - lock.at >= 1000, 'the lock is visible before the second spin');
  for (let i = 1; i < taps.length; i++) assert.ok(startOf(taps[i]) >= taps[i - 1].at, 'one finger at a time');
});
test('words and types: three fixed reels', () => {
  assert.equal(DEMO_WORDS.length, 3);
  assert.equal(DEMO_TYPES.length, 3);
  assert.ok(DEMO_WORDS.every(w => typeof w === 'string' && w));
  assert.deepEqual(DEMO_SCRIPT.filter(s => s.act === 'stop').map(s => s.reel), [0, 1, 2, 1, 2]);
});

test('sweepAt: a finger goes right along the tray, then comes back left; stays inside the tray', () => {
  for (const W of [200, 280, 340]) {
    const a = sweepAt(0, W), m = sweepAt(0.5, W), z = sweepAt(1, W);
    assert.ok(a.x < m.x && z.x < m.x, 'right, then back');
    for (let p = 0; p <= 1; p += 0.05) {
      const q = sweepAt(p, W);
      assert.ok(q.x >= 35 && q.x <= 35 + 128 + (W - 200), `x ${q.x} at W=${W}`);
      assert.ok(q.y >= 160 && q.y <= 190, `y ${q.y}`);
    }
  }
  assert.deepEqual(sweepAt(-1, 200), sweepAt(0, 200));
  assert.deepEqual(sweepAt(2, 200), sweepAt(1, 200));
});
