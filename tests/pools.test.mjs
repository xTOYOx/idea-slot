import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPools } from '../src/pools.js';
const data = {
  words: { animal: ['犬', '猫'], plant: ['桜'], food: [], person: [], place: [], tool: [], nature: [], body: [], feeling: [], event: [], abstract: [], other: [] },
  verbs: ['走る'],
  genres: [{ ja: 'ローグライク', en: 'Roguelike' }],
  tags: { look: [{ ja: '8bit', en: '8-bit' }], mood: [], mechanic: [] },
};
test('unions and labels', () => {
  const p = buildPools(data, {}, []);
  assert.deepEqual(p['noun:animal'], ['犬', '猫']);
  assert.deepEqual(p.noun.sort(), ['桜', '犬', '猫'].sort());
  assert.deepEqual(p.genre, ['ローグライク']);
  assert.deepEqual(p.tag, ['8bit']);
  assert.equal(p.any.length, 6);
});
test('custom is added, excluded is removed everywhere', () => {
  const p = buildPools(data, { 'noun:animal': ['カワウソ'] }, ['犬']);
  assert.deepEqual(p['noun:animal'].sort(), ['カワウソ', '猫'].sort());
  assert.ok(p.noun.includes('カワウソ') && !p.noun.includes('犬'));
  assert.ok(!p.any.includes('犬'));
});
test('union pools are deduplicated', () => {
  const d = { ...data, genres: [{ ja: 'ホラー', en: 'Horror' }], tags: { look: [], mood: [{ ja: 'ホラー', en: 'Horror' }], mechanic: [] } };
  const p = buildPools(d, {}, []);
  assert.equal(p.any.filter(w => w === 'ホラー').length, 1);
});
