import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_SCRIPT, DEMO_WORDS, DEMO_TYPES, LEVER_RAMP_MS, SWEEP_MS, modeOf, sweepAt } from '../src/demo.js';

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

test('script: sorted by time, starts with a reset, ends with end, 8 to 12 seconds in all', () => {
  assert.equal(DEMO_SCRIPT[0].act, 'reset');
  assert.equal(DEMO_SCRIPT.at(-1).act, 'end');
  for (let i = 1; i < DEMO_SCRIPT.length; i++) assert.ok(DEMO_SCRIPT[i].at >= DEMO_SCRIPT[i - 1].at, `step ${i} is out of order`);
  const total = DEMO_SCRIPT.at(-1).at;
  assert.ok(total >= 8000 && total <= 12000, `total ${total}ms`);
});
test('script: wait 1s, pull the lever, stop reels 1..3 one by one, then IDEA!, then sweep the coins', () => {
  const acts = DEMO_SCRIPT.filter(s => s.act !== 'reset' && s.act !== 'end');
  assert.deepEqual(acts.map(s => s.act + (s.reel ?? '')), ['lever', 'stop0', 'stop1', 'stop2', 'idea', 'sweep']);
  assert.equal(acts[0].at, 1000);
  const t = acts.map(s => s.at);
  assert.ok(t[1] >= t[0] + LEVER_RAMP_MS + 500, 'a pause between the pull and the first stop');
  assert.ok(t[2] - t[1] >= 500 && t[3] - t[2] >= 500, 'reels stop one by one with room between');
  assert.ok(t[5] - t[4] >= 1500, 'the coins have time to land before the sweep');
  assert.ok(DEMO_SCRIPT.at(-1).at - t[5] >= SWEEP_MS, 'the sweep finishes before the end');
});
test('words and types: three fixed reels', () => {
  assert.equal(DEMO_WORDS.length, 3);
  assert.equal(DEMO_TYPES.length, 3);
  assert.ok(DEMO_WORDS.every(w => typeof w === 'string' && w));
  assert.deepEqual(DEMO_SCRIPT.filter(s => s.act === 'stop').map(s => s.reel), [0, 1, 2]);
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
