import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasCombo, cleanTags, cleanRating, toggleRating, addTags, removeTag, tagsOf, viewHits, formatHits, isActive } from '../src/hits.js';

const F = (combo, o = {}) => ({ combo, memo: '', savedAt: 0, rating: 0, tags: [], ...o });

test('cleanTags: trims, drops empty/duplicates/non-strings; non-array → []', () => {
  assert.deepEqual(cleanTags([' a ', '', 'a', 'b', 3, '  ']), ['a', 'b']);
  assert.deepEqual(cleanTags('x'), []);
  assert.deepEqual(cleanTags(undefined), []);
});
test('cleanRating: integer 0..5, otherwise 0', () => {
  assert.deepEqual([0, 3, 5].map(cleanRating), [0, 3, 5]);
  assert.deepEqual([6, -1, 2.5, '3', null, undefined].map(cleanRating), [0, 0, 0, 0, 0, 0]);
});
test('toggleRating: same number again clears to 0', () => {
  assert.equal(toggleRating(2, 4), 4);
  assert.equal(toggleRating(4, 4), 0);
});
test('addTags: splits on 、 and ,, trims, no duplicates', () => {
  assert.deepEqual(addTags(['a'], ' b、c,a , '), ['a', 'b', 'c']);
  assert.deepEqual(addTags(['a'], '  '), ['a']);
});
test('removeTag / tagsOf', () => {
  assert.deepEqual(removeTag(['a', 'b'], 'a'), ['b']);
  assert.deepEqual(tagsOf([F(['x'], { tags: ['b', 'a'] }), F(['y'], { tags: ['a', 'c'] })]), ['a', 'b', 'c']);
});

const L = [
  F(['犬', '空'], { savedAt: 30, rating: 2, memo: 'ねこ', tags: ['pet'] }),
  F(['猫', '海'], { savedAt: 20, rating: 5, tags: ['pet', 'sea'] }),
  F(['鳥', '森'], { savedAt: 10, rating: 5 }),
];
const V = o => viewHits(L, { sort: 'new', text: '', min: 0, tag: '', ...o }).map(x => x.i);

test('viewHits: sort new / old / stars (stars ties: newer first)', () => {
  assert.deepEqual(V({}), [0, 1, 2]);
  assert.deepEqual(V({ sort: 'old' }), [2, 1, 0]);
  assert.deepEqual(V({ sort: 'stars' }), [1, 2, 0]);
});
test('viewHits: ties keep the stored order (newest-first list) when savedAt is equal', () => {
  const same = [F(['a']), F(['b']), F(['c'])];
  assert.deepEqual(viewHits(same, { sort: 'new' }).map(x => x.i), [0, 1, 2]);
  assert.deepEqual(viewHits(same, { sort: 'old' }).map(x => x.i), [2, 1, 0]);
});
test('viewHits: text matches words, memo and tags (partial); min stars; tag', () => {
  assert.deepEqual(V({ text: '犬' }), [0]);
  assert.deepEqual(V({ text: 'ねこ' }), [0]);
  assert.deepEqual(V({ text: 'se' }), [1]);
  assert.deepEqual(V({ text: ' 海 ' }), [1]);
  assert.deepEqual(V({ min: 5 }), [1, 2]);
  assert.deepEqual(V({ tag: 'pet' }), [0, 1]);
  assert.deepEqual(V({ tag: 'pet', min: 3, text: '猫' }), [1]);
  assert.deepEqual(V({ text: 'zzz' }), []);
});
test('viewHits keeps the original index and does not mutate', () => {
  const before = JSON.stringify(L);
  const r = viewHits(L, { sort: 'old' });
  assert.equal(r[0].f, L[2]);
  assert.equal(JSON.stringify(L), before);
});
test('isActive: any filter set', () => {
  assert.equal(isActive({ sort: 'old', text: '', min: 0, tag: '' }), false);
  assert.equal(isActive({ text: ' ', min: 0, tag: '' }), false);
  assert.equal(isActive({ text: 'a' }), true);
  assert.equal(isActive({ min: 1 }), true);
  assert.equal(isActive({ tag: 'x' }), true);
});

const A = F(['A', 'B', 'C'], { rating: 3, tags: ['x', 'y'], memo: 'one\ntwo' });
const B = F(['D', 'E']);
test('formatHits text: "A×B×C ★3 #タグ" + memo line', () => {
  assert.equal(formatHits([A, B], 'text'), 'A×B×C ★3 #x #y\none\ntwo\nD×E');
});
test('formatHits markdown: bold combo, ★☆, indented memo', () => {
  assert.equal(formatHits([A, B], 'md'), '- **A × B × C** ★★★☆☆ #x #y\n  one\n  two\n- **D × E**');
});
test('formatHits: empty list → empty string', () => assert.equal(formatHits([], 'text'), ''));
test('hasCombo: exact same words in the same order', () => {
  assert.equal(hasCombo(L, ['猫', '海']), true);
  assert.equal(hasCombo(L, ['海', '猫']), false);
  assert.equal(hasCombo(L, ['猫']), false);
});
