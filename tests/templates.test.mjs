import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTemplate, describeSlots, addTemplate, replaceTemplate, removeTemplate, applySlots } from '../src/templates.js';

const S = (...types) => types.map(type => ({ type }));

test('cleanTemplate: trims the name, keeps only {type}, rejects bad shapes', () => {
  assert.deepEqual(cleanTemplate({ name: ' 動物 ', slots: [{ type: 'a', value: 'x' }, { type: 'b' }] }), { name: '動物', slots: S('a', 'b') });
  for (const bad of [null, 'x', { name: '', slots: S('a', 'b') }, { name: '  ', slots: S('a', 'b') }, { name: 'n' }, { name: 'n', slots: S('a') },
    { name: 'n', slots: S('a', 'b', 'c', 'd', 'e') }, { name: 'n', slots: [{ type: 'a' }, { type: 5 }] }, { name: 'n', slots: [{ type: 'a' }, null] }, { name: 1, slots: S('a', 'b') }]) {
    assert.equal(cleanTemplate(bad), null, JSON.stringify(bad));
  }
});

test('describeSlots: count and the type labels', () => {
  assert.equal(describeSlots(S('animal', 'game', 'any'), t => ({ animal: '動物', game: 'ゲーム用語', any: '全部ランダム' })[t]), '3本：動物 × ゲーム用語 × 全部ランダム');
  assert.equal(describeSlots(S('a', 'b'), t => t.toUpperCase()), '2本：A × B');
});

test('addTemplate: trims, refuses empty and duplicate names, appends', () => {
  const list = [{ name: 'A', slots: S('x', 'y') }];
  assert.deepEqual(addTemplate(list, ' B ', S('p', 'q')), [...list, { name: 'B', slots: S('p', 'q') }]);
  assert.equal(addTemplate(list, '  ', S('p', 'q')), null);
  assert.equal(addTemplate(list, 'A ', S('p', 'q')), null);
  assert.equal(list.length, 1);
});
test('addTemplate / replaceTemplate store only {type} of the slots', () => {
  const full = [{ type: 'p', value: 'v', held: true }, { type: 'q', value: null, held: false }];
  assert.deepEqual(addTemplate([], 'A', full), [{ name: 'A', slots: S('p', 'q') }]);
  assert.deepEqual(replaceTemplate([{ name: 'A', slots: S('x', 'y') }], 'A', full), [{ name: 'A', slots: S('p', 'q') }]);
});
test('replaceTemplate keeps the position and other entries; unknown name is unchanged', () => {
  const list = [{ name: 'A', slots: S('x', 'y') }, { name: 'B', slots: S('x', 'y', 'z') }];
  assert.deepEqual(replaceTemplate(list, 'A', S('p', 'q')), [{ name: 'A', slots: S('p', 'q') }, list[1]]);
  assert.deepEqual(replaceTemplate(list, 'Z', S('p', 'q')), list);
});
test('removeTemplate', () => {
  const list = [{ name: 'A', slots: S('x', 'y') }, { name: 'B', slots: S('x', 'y') }];
  assert.deepEqual(removeTemplate(list, 'A'), [list[1]]);
});

test('applySlots: unknown / vanished types become any; mixes keep their valid parts', () => {
  const ok = k => ['animal', 'verb', 'my:海'].includes(k);
  assert.deepEqual(applySlots(S('animal', 'my:消えた', 'ghost', 'mix:verb|my:消えた', 'mix:ghost|my:消えた', 'any'), ok),
    S('animal', 'any', 'any', 'verb', 'any', 'any'));
  assert.deepEqual(applySlots(S('mix:animal|my:海'), ok), S('mix:animal|my:海'));
});
