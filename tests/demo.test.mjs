import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_SCRIPT, DEMO_WORDS, DEMO_TYPES, LEVER_RAMP_MS, TAP_MS, modeOf, startOf } from '../src/demo.js';

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

const END = DEMO_SCRIPT.at(-1).at;
// 前半（最初の scene まで）と、後半の場面ごと（scene から次の scene の手前まで）
const firstScene = DEMO_SCRIPT.findIndex(s => s.act === 'scene' && s.at > 0);
const head = DEMO_SCRIPT.slice(0, firstScene);
const scenes = [];
for (const s of DEMO_SCRIPT.slice(firstScene)) {
  if (s.act === 'scene') scenes.push([s]);
  else if (s.act !== 'end') scenes.at(-1).push(s);
}

test('script: sorted by time, starts with a reset, ends with end, about 28 seconds in all', () => {
  assert.equal(DEMO_SCRIPT[0].act, 'reset');
  assert.equal(DEMO_SCRIPT.at(-1).act, 'end');
  for (let i = 1; i < DEMO_SCRIPT.length; i++) assert.ok(DEMO_SCRIPT[i].at >= DEMO_SCRIPT[i - 1].at, `step ${i} is out of order`);
  assert.ok(END >= 25000 && END <= 30000, `total ${END}ms`);
  assert.ok(DEMO_SCRIPT.every(s => ['reset', 'scene', 'lever', 'stop', 'tap', 'end'].includes(s.act)), 'a small set of acts');
});
test('script (first half): spin and stop, LOCK reel 1, spin again, IDEA!, then the theme panel', () => {
  const acts = head.filter(s => s.act !== 'reset');
  assert.deepEqual(acts.map(s => s.act + (s.reel ?? '')), ['lever', 'stop0', 'stop1', 'stop2', 'tap', 'lever', 'stop1', 'stop2', 'tap', 'tap', 'tap', 'tap']);
  assert.deepEqual(acts.filter(s => s.act === 'tap').map(s => s.sel), ['[data-s="0"]', '#idea', '[data-mon="1"]', '#types [data-ty="extra:yokai"]', '#types [data-close]']);
  const levers = acts.filter(s => s.act === 'lever');
  assert.ok(levers[0].at >= 2000, 'the title has time to show on the idle cabinet');
  assert.ok(levers.every(s => s.words.length === 3 && s.words.every(Boolean)));
  assert.deepEqual(levers.at(-1).words, DEMO_WORDS, 'the last spin lands on the hit');
  assert.equal(levers[0].words[0], DEMO_WORDS[0], 'the locked word stays the same');
  const stops = acts.filter(s => s.act === 'stop');
  assert.ok(stops[0].at >= levers[0].at + LEVER_RAMP_MS + 500, 'a pause between the pull and the first stop');
  assert.ok(stops.every((s, i) => i === 0 || s.at - stops[i - 1].at >= 500), 'reels stop one by one with room between');
});
test('script (montage): four scenes, 4 / 7 / 5 / 3 reels, each pulls at once and stops left to right', () => {
  assert.deepEqual(scenes.map(sc => sc[0].types.length), [4, 7, 5, 3]);
  scenes.forEach((sc, k) => {
    const [at, lever, ...rest] = sc, n = at.types.length;
    assert.equal(lever.act, 'lever');
    assert.equal(lever.words.length, n, `scene ${k}: a word for each reel`);
    assert.equal(new Set(lever.words).size, n, `scene ${k}: no repeated word`);
    assert.ok(lever.at - at.at <= 200, 'pull the lever right away');
    const stops = rest.filter(s => s.act === 'stop');
    assert.deepEqual(stops.map(s => s.reel), [...Array(n).keys()], 'left to right');
    assert.ok(Math.abs(stops[0].at - lever.at - 900) <= 100, 'the first stop comes 0.9 s after the lever');
    assert.ok(stops.every((s, i) => i === 0 || (s.at - stops[i - 1].at >= 250 && s.at - stops[i - 1].at <= 300)), 'stagger 0.25 to 0.3 s');
    const next = scenes[k + 1]?.[0].at ?? END;
    assert.ok(stops.at(-1).at <= next - 400, 'the last word stays on screen a moment');
  });
  // IDEA! は後ろの 2 場面だけ。最後の語が止まって 0.5 秒後
  assert.deepEqual(scenes.map(sc => sc.some(s => s.act === 'tap' && s.sel === '#idea')), [false, false, true, true]);
  for (const sc of scenes.slice(2)) {
    const last = sc.filter(s => s.act === 'stop').at(-1), idea = sc.find(s => s.act === 'tap');
    assert.equal(idea.at - last.at, 500);
  }
  assert.ok(scenes.flat().every(s => s.at < END));
});
test('tap: a finger appears TAP_MS before the press, one finger at a time, and the LOCK shows before the second spin', () => {
  const taps = DEMO_SCRIPT.filter(s => s.act === 'tap');
  assert.ok(taps.every(s => s.sel && startOf(s) === s.at - TAP_MS && startOf(s) >= 0));
  assert.equal(startOf({ at: 1000, act: 'lever' }), 1000);
  const second = DEMO_SCRIPT.find(s => s.act === 'lever' && s.at > taps[0].at);
  assert.ok(second.at - taps[0].at >= 1000);
  for (let i = 1; i < taps.length; i++) {
    const before = DEMO_SCRIPT.filter(s => s.at < taps[i].at && s.act === 'stop').at(-1);
    assert.ok(startOf(taps[i]) >= taps[i - 1].at, 'one finger at a time');
    assert.ok(taps[i].sel !== '#idea' || before.at < startOf(taps[i]), 'IDEA! is pressed after the last reel stops');
  }
});
test('words and types: three fixed reels at the start', () => {
  assert.equal(DEMO_WORDS.length, 3);
  assert.equal(DEMO_TYPES.length, 3);
  assert.ok(DEMO_WORDS.every(w => typeof w === 'string' && w));
});
