import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPools } from '../src/pools.js';
const data = {
  words: { animal: ['犬', '猫'], plant: ['桜'], food: [], person: [], place: [], tool: [], nature: [], body: [], feeling: [], event: [], abstract: [], other: [] },
  verbs: ['走る'],
  genres: [{ ja: 'ローグライク', en: 'Roguelike' }],
  games: [{ ja: 'テトリス', en: 'Tetris' }],
  tags: { look: [{ ja: '8bit', en: '8-bit' }], mood: [], mechanic: [] },
  extra: { ono: ['ふわふわ'], jfood: ['すし', '犬'], net: [] },
};
test('unions and labels', () => {
  const p = buildPools(data, {}, []);
  assert.deepEqual(p['noun:animal'], ['犬', '猫']);
  assert.deepEqual(p.noun.sort(), ['桜', '犬', '猫'].sort());
  assert.deepEqual(p.genre, ['ローグライク']);
  assert.deepEqual(p.tag, ['8bit']);
  assert.deepEqual(p.game, ['テトリス']);
  assert.equal(p.any.length, 8); // game は any に入らない。テーマ集（ふわふわ・すし）は入る（犬は動物と重複）
  assert.deepEqual(p['extra:ono'], ['ふわふわ']);
  assert.deepEqual(p['extra:net'], []);
  assert.deepEqual(p.extra.sort(), ['すし', 'ふわふわ', '犬'].sort());
});
test('custom is added, excluded is removed everywhere', () => {
  const p = buildPools(data, { 'noun:animal': ['カワウソ'] }, ['犬']);
  assert.deepEqual(p['noun:animal'].sort(), ['カワウソ', '猫'].sort());
  assert.ok(p.noun.includes('カワウソ') && !p.noun.includes('犬'));
  assert.ok(!p.any.includes('犬'));
});
test('game pool takes custom words and drops excluded ones', () => {
  const p = buildPools(data, { game: ['スイカゲーム'] }, ['テトリス']);
  assert.deepEqual(p.game, ['スイカゲーム']);
  assert.ok(!p.any.includes('スイカゲーム'));
});
test('union pools are deduplicated', () => {
  const d = { ...data, genres: [{ ja: 'ホラー', en: 'Horror' }], tags: { look: [], mood: [{ ja: 'ホラー', en: 'Horror' }], mechanic: [] } };
  const p = buildPools(d, {}, []);
  assert.equal(p.any.filter(w => w === 'ホラー').length, 1);
});

import { baseWords } from '../src/pools.js';
test('baseWords gives the original words of one type (before custom / excluded)', () => {
  assert.deepEqual(baseWords(data, 'noun:animal'), ['犬', '猫']);
  assert.deepEqual(baseWords(data, 'verb'), ['走る']);
  assert.deepEqual(baseWords(data, 'genre'), ['ローグライク']);
  assert.deepEqual(baseWords(data, 'game'), ['テトリス']);
  assert.deepEqual(baseWords(data, 'tag:look'), ['8bit']);
  assert.deepEqual(baseWords(data, 'tag:mood'), []);
  for (const k of ['any', 'noun', 'tag', 'my:海', 'noun:nope']) assert.deepEqual(baseWords(data, k), []);
});
test('extra: baseWords per theme, pools.extra is the union, any includes it', () => {
  assert.deepEqual(baseWords(data, 'extra:jfood'), ['すし', '犬']);
  assert.deepEqual(baseWords(data, 'extra:nope'), []);
  assert.deepEqual(baseWords(data, 'extra'), []);
  const p = buildPools(data, { 'extra:ono': ['ぷるぷる'] }, ['すし']);
  assert.deepEqual(p['extra:ono'], ['ふわふわ', 'ぷるぷる']);
  assert.deepEqual(p['extra:jfood'], ['犬']);
  assert.ok(p.extra.includes('ぷるぷる') && !p.extra.includes('すし'));
  assert.ok(p.any.includes('ぷるぷる'));
});
test('extra data may be missing: no extra words, no crash', () => {
  const { extra, ...rest } = data;
  const p = buildPools(rest, {}, []);
  assert.deepEqual(p.extra, []);
  assert.equal(p.any.length, 6);
});

test('rule (制約) is its own theme only: not in extra (all) and not in any', () => {
  const d = { ...data, extra: { ...data.extra, rule: ['ワンボタン操作', 'すし'] } };
  const p = buildPools(d, { 'extra:rule': ['色は2色だけ'] }, []);
  assert.deepEqual(baseWords(d, 'extra:rule'), ['ワンボタン操作', 'すし']);
  assert.deepEqual(p['extra:rule'], ['ワンボタン操作', 'すし', '色は2色だけ']);
  assert.ok(!p.extra.includes('ワンボタン操作') && !p.extra.includes('色は2色だけ'));
  assert.ok(!p.any.includes('ワンボタン操作') && !p.any.includes('色は2色だけ'));
  assert.ok(p.extra.includes('すし') && p.any.includes('すし')); // 同じ語が他のテーマにもあれば、そちらで入る
  assert.equal(buildPools(d, {}, ['ワンボタン操作'])['extra:rule'].includes('ワンボタン操作'), false);
});
