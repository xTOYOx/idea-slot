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
test('stopAll stops every spinning reel', () => {
  const { reels } = M.startSpin([R('x'), R('y', true), R('z')], pools);
  const s = M.stopAll(reels, 500);
  assert.equal(M.allStopped(s), true);
  assert.equal(s[0].value, reels[0].target);
  assert.equal(s[2].stoppedAt, 500);
  assert.equal(s[1].stoppedAt, undefined);
});
test('pressReel: stop, then ignored within 300ms, then lock/unlock', () => {
  let { reels } = M.startSpin([R('x'), R('y')], pools);
  let p = M.pressReel(reels, 0, 1000); assert.equal(p.action, 'stop');
  p = M.pressReel(p.reels, 0, 1200); assert.equal(p.action, 'ignored');
  p = M.pressReel(p.reels, 0, 1400); assert.equal(p.action, 'lock'); assert.equal(p.reels[0].held, true);
  p = M.pressReel(p.reels, 0, 1500); assert.equal(p.action, 'unlock'); assert.equal(p.reels[0].held, false);
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
test('excludeAt unlocks and rerolls', () => {
  const out = M.excludeAt([R('x', true), R('y')], 0, { a: ['z'] });
  assert.deepEqual(out[0], { type: 'a', value: 'z', held: false });
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
  const out = M.restore([{ type: 'theme:宇宙', base: 'noun', value: 'x', held: false }], ['p']);
  assert.deepEqual([out[0].type, out[0].base, out[0].value], ['theme:宇宙', 'noun', 'p']);
});
test('pure: inputs not mutated', () => {
  const inp = [R('x'), R('y')]; const copy = structuredClone(inp);
  M.startSpin(inp, pools); M.pressReel(inp, 0, 0); M.restore(inp, ['a']);
  assert.deepEqual(inp, copy);
});
