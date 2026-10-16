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
const anyPools = { noun: ['n1', 'n2', 'n3'], verb: ['v1'], genre: ['g1'], tag: ['t1'], any: ['n1', 'n2', 'n3', 'v1', 'g1', 't1'] };
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
test("'any' picks a group uniformly, then a word from it", () => {
  assert.equal(spin([S('any')], anyPools, seq(0.0, 0.5))[0].value.startsWith('n'), true);
  assert.equal(spin([S('any')], anyPools, seq(0.3, 0))[0].value, 'v1');
  assert.equal(spin([S('any')], anyPools, seq(0.6, 0))[0].value, 'g1');
  assert.equal(spin([S('any')], anyPools, seq(0.9, 0))[0].value, 't1');
});
test("'any' falls back to other groups when the chosen one is used up", () => {
  const out = spin([S('any'), S('any'), S('any'), S('any')], anyPools, seq(0.3)).map(s => s.value);
  assert.equal(new Set(out).size, 4);
  assert.ok(out.every(Boolean));
});
test("'any' is not weighted by pool size", () => {
  const p = { noun: Array.from({ length: 1000 }, (_, i) => `n${i}`), verb: [], genre: ['g1'], tag: [] };
  let genre = 0;
  for (let i = 0; i < 400; i++) if (spin([S('any')], p)[0].value === 'g1') genre++;
  assert.ok(genre >= 50, `genre appeared ${genre} times`);
});
