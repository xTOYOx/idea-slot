import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/machine.js';
const pools = { a: ['x', 'y', 'z', 'w'] };
const R = (value, held = false) => ({ type: 'a', value, held });

test('startSpin runs only unlocked reels and sets targets', () => {
  const r = M.startSpin([R('x', true), R('y'), R('z')], pools);
  assert.equal(r.ok, true);
  assert.deepEqual(r.reels.map(x => !!x.running), [false, true, true]);
  assert.equal(r.reels[1].value, 'y');               // unchanged until stop
  assert.ok(r.reels[1].target && r.reels[2].target);
  assert.notEqual(r.reels[1].target, 'x');           // no duplicate with locked word
});
test('startSpin refuses when all locked or already spinning', () => {
  assert.deepEqual(M.startSpin([R('x', true), R('y', true)], pools), { ok: false, reason: 'allLocked' });
  const { reels } = M.startSpin([R('x'), R('y')], pools);
  assert.deepEqual(M.startSpin(reels, pools), { ok: false, reason: 'spinning' });
});
test('stopReel reveals target', () => {
  const { reels } = M.startSpin([R('x'), R('y')], pools);
  const s = M.stopReel(reels, 0, 1000);
  assert.equal(s[0].value, reels[0].target);
  assert.equal(s[0].running, false);
  assert.equal(s[1].running, true);
});
test('pressReel: stop, then ignored within 300ms, then lock/unlock', () => {
  let { reels } = M.startSpin([R('x'), R('y')], pools);
  let p = M.pressReel(reels, 0, 1000); assert.equal(p.action, 'stop');
  p = M.pressReel(p.reels, 0, 1200); assert.equal(p.action, 'ignored');
  p = M.pressReel(p.reels, 0, 1400); assert.equal(p.action, 'lock'); assert.equal(p.reels[0].held, true);
  p = M.pressReel(p.reels, 0, 1500); assert.equal(p.action, 'unlock'); assert.equal(p.reels[0].held, false);
});
test('canHold / setHeld: lock needs a stopped, unlocked reel with a word; unlock needs a locked one', () => {
  const reels = [R('x'), R('y', true), R(null), { ...R('z'), running: true }];
  assert.deepEqual([0, 1, 2, 3, 4].map(i => M.canHold(reels, i, true)), [true, false, false, false, false]);
  assert.deepEqual([0, 1, 2, 3, 4].map(i => M.canHold(reels, i, false)), [false, true, false, false, false]);
  assert.equal(M.setHeld(reels, 0, true)[0].held, true);
  assert.equal(M.setHeld(reels, 1, false)[1].held, false);
  assert.deepEqual(M.setHeld(reels, 1, true), reels); // できないときは何もしない
  assert.deepEqual(M.setHeld(reels, 3, true), reels);
});
test('canHold: just after a stop it waits LOCK_GUARD_MS when now is given', () => {
  const reels = [{ ...R('x'), stoppedAt: 1000 }];
  assert.equal(M.canHold(reels, 0, true, 1200), false);
  assert.equal(M.canHold(reels, 0, true, 1300), true);
  assert.equal(M.canHold(reels, 0, true), true);
});
test('isSpinning / allStopped', () => {
  const { reels } = M.startSpin([R('x'), R('y')], pools);
  assert.equal(M.isSpinning(reels), true);
  assert.equal(M.allStopped(reels), false);
  assert.equal(M.isSpinning([R('x')]), false);
  assert.equal(M.allStopped([R('x')]), true);
});
test('canSave states', () => {
  const stopped = [R('x'), R('y')];
  assert.equal(M.canSave(stopped, []), 'ok');
  assert.equal(M.canSave(stopped, [{ combo: ['x', 'y'] }]), 'saved');
  assert.equal(M.canSave([R('x'), R(null)], []), 'empty');
  assert.equal(M.canSave(M.startSpin(stopped, pools).reels, []), 'spinning');
});
test('canEdit false while spinning', () => {
  assert.equal(M.canEdit([R('x')]), true);
  assert.equal(M.canEdit(M.startSpin([R('x')], pools).reels), false);
});
test('autoStopDelays', () => {
  const { reels } = M.startSpin([R('x'), R('y', true), R('z')], pools);
  assert.deepEqual(M.autoStopDelays(reels), [600, null, 1240]);
});
test('restore resizes and clears locks', () => {
  const out = M.restore([R('x', true), R('y', true), R('z')], ['p', 'q']);
  assert.deepEqual(out.map(r => [r.value, r.held, !!r.running]), [['p', false, false], ['q', false, false]]);
});
test('restore grows with any-type slots', () => {
  const out = M.restore([R('x')], ['p', 'q', 'r']);
  assert.deepEqual(out.map(r => [r.type, r.value]), [['a', 'p'], ['any', 'q'], ['any', 'r']]);
});
test('restore keeps theme fields on the reel', () => {
  const out = M.restore([{ type: 'theme:宇宙', base: 'noun', value: 'x', held: false, target: 'y', stoppedAt: 5 }], ['p']);
  assert.deepEqual([out[0].type, out[0].base, out[0].value], ['theme:宇宙', 'noun', 'p']);
  assert.deepEqual([out[0].target, out[0].stoppedAt], [undefined, undefined]);
});
test('pure: inputs not mutated', () => {
  const inp = [R('x'), R('y')]; const copy = structuredClone(inp);
  M.startSpin(inp, pools); M.pressReel(inp, 0, 0); M.restore(inp, ['a']); M.setHeld(inp, 0, true);
  assert.deepEqual(inp, copy);
});
