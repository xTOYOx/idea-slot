import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, searchWords } from '../src/search.js';
const pools = { 'noun:animal': ['ネコ', 'ネコザメ', 'コネコ'], verb: ['寝転ぶ'], genre: ['ネコ'], 'tag:look': ['8ビット'], noun: ['ネコ'], tag: ['8ビット'], any: ['ネコ'] };
const labels = { 'noun:animal': '動物', verb: '動詞', genre: 'ゲームジャンル', 'tag:look': 'タグ：見た目' };
test('index skips union keys and dedupes', () => {
  const ix = buildIndex(pools, labels);
  assert.equal(ix.filter(x => x.w === 'ネコ').length, 1);
  assert.deepEqual(ix.find(x => x.w === '8ビット'), { w: '8ビット', label: 'タグ：見た目' });
});
test('dedupe keeps first by fixed key order (noun before genre)', () => {
  const ix = buildIndex(pools, labels);
  assert.equal(ix.find(x => x.w === 'ネコ').label, '動物');
});
test('exact, prefix, then contains; limit; empty', () => {
  const ix = buildIndex(pools, labels);
  assert.deepEqual(searchWords(ix, ' ネコ ').map(x => x.w), ['ネコ', 'ネコザメ', 'コネコ']);
  assert.equal(searchWords(ix, 'ネコ', 2).length, 2);
  assert.deepEqual(searchWords(ix, '  '), []);
  assert.deepEqual(searchWords(ix, '.*'), []);
});
test('index ignores theme keys', () => {
  const ix = buildIndex({ ...pools, 'theme:宇宙': ['銀河'] }, { ...labels, 'theme:宇宙': 'テーマ' });
  assert.equal(ix.some(x => x.w === '銀河'), false);
});
test('extra entries come after dictionary words; dictionary wins on duplicates', () => {
  const ix = buildIndex(pools, labels, [{ w: '銀河', label: '★宇宙' }, { w: 'ネコ', label: '★猫' }, { w: '銀河', label: '★星' }]);
  assert.deepEqual(ix.slice(-1), [{ w: '銀河', label: '★宇宙' }]);
  assert.equal(ix.find(x => x.w === 'ネコ').label, '動物');
  assert.equal(ix.filter(x => x.w === '銀河').length, 1);
});
test('game titles are indexed with the game label', () => {
  const ix = buildIndex({ ...pools, game: ['テトリス'] }, { ...labels, game: 'ゲーム' });
  assert.deepEqual(ix.find(x => x.w === 'テトリス'), { w: 'テトリス', label: 'ゲーム' });
});
