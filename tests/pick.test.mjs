import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spin, rerollOne, setSlotType, resizeSlots } from '../src/pick.js';
const pools = { a: ['x', 'y', 'z'], one: ['solo'], empty: [] };
const S = (type, value = null, held = false) => ({ type, value, held });

test('held slots keep value, others get filled', () => {
  const out = spin([S('a', 'x', true), S('a'), S('a')], pools);
  assert.equal(out[0].value, 'x');
  assert.ok(out[1].value && out[2].value);
});
test('no duplicate values in one result', () => {
  for (let i = 0; i < 200; i++) {
    const v = spin([S('a'), S('a'), S('a')], pools).map(s => s.value);
    assert.equal(new Set(v).size, 3);
  }
});
test('all held → same values, no error', () => {
  const s = [S('a', 'x', true), S('a', 'y', true)];
  assert.deepEqual(spin(s, pools), s);
});
test('pool smaller than slots → leftover is null, terminates', () => {
  const v = spin([S('one'), S('one'), S('empty')], pools).map(s => s.value);
  assert.deepEqual(v.filter(Boolean), ['solo']);
  assert.equal(v.filter(x => x === null).length, 2);
});
test('spin does not mutate input', () => {
  const s = [S('a')];
  spin(s, pools);
  assert.equal(s[0].value, null);
});
test('rerollOne changes only slot i even if held', () => {
  const s = [S('a', 'x', true), S('a', 'y', true)];
  const out = rerollOne(s, 1, pools, () => 0.99);
  assert.equal(out[0].value, 'x');
  assert.notEqual(out[1].value, 'x');
});
test('setSlotType clears value and hold', () => {
  const out = setSlotType([S('a', 'x', true)], 0, 'one');
  assert.deepEqual(out[0], S('one'));
});
test('resizeSlots keeps existing, pads with any', () => {
  const out = resizeSlots([S('a', 'x', true), S('a')], 4);
  assert.equal(out.length, 4);
  assert.deepEqual(out[0], S('a', 'x', true));
  assert.equal(out[3].type, 'any');
  assert.equal(resizeSlots(out, 2).length, 2);
});
