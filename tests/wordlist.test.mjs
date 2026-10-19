import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordCount, wordRows, newCustom } from '../src/wordlist.js';

test('wordCount: base + custom (deduplicated) minus excluded', () => {
  assert.equal(wordCount(['犬', '猫'], ['猫', '鳥'], ['犬']), 2); // 猫・鳥
  assert.equal(wordCount([], [], ['犬']), 0);
  assert.equal(wordCount(['犬'], undefined, undefined), 1);
});

test('wordRows: added first, then base, then excluded; kinds marked', () => {
  const r = wordRows({ base: ['犬', '猫', '鳥'], custom: ['カワウソ'], excluded: ['猫'] });
  assert.deepEqual(r.rows, [
    { w: 'カワウソ', kind: 'added' }, { w: '犬', kind: 'base' }, { w: '鳥', kind: 'base' }, { w: '猫', kind: 'off' },
  ]);
  assert.equal(r.total, 4);
  assert.equal(r.more, 0);
});

test('wordRows: a custom word already in base is just a base word; excluded custom words are "off"', () => {
  const r = wordRows({ base: ['犬'], custom: ['犬', 'カワウソ', 'ビーバー'], excluded: ['ビーバー'] });
  assert.deepEqual(r.rows, [{ w: 'カワウソ', kind: 'added' }, { w: '犬', kind: 'base' }, { w: 'ビーバー', kind: 'off' }]);
});

test('wordRows: excluded words that are not in this type are not listed; duplicates collapse', () => {
  const r = wordRows({ base: ['犬', '犬'], custom: [], excluded: ['魚', '犬'] });
  assert.deepEqual(r.rows, [{ w: '犬', kind: 'off' }]);
});

test('wordRows: q is a trimmed, case-insensitive substring match', () => {
  const base = ['Dog', 'doghouse', '猫', '黒猫', 'bird'];
  assert.deepEqual(wordRows({ base, q: ' DOG ' }).rows.map(x => x.w), ['Dog', 'doghouse']);
  assert.deepEqual(wordRows({ base, q: '猫' }).rows.map(x => x.w), ['猫', '黒猫']);
  assert.equal(wordRows({ base, q: 'zzz' }).total, 0);
  assert.equal(wordRows({ base, q: '   ' }).total, 5);
});

test('wordRows: q applies to every group', () => {
  const r = wordRows({ base: ['黒猫', '犬'], custom: ['白猫'], excluded: ['黒猫'], q: '猫' });
  assert.deepEqual(r.rows, [{ w: '白猫', kind: 'added' }, { w: '黒猫', kind: 'off' }]);
});

test('wordRows: limit cuts the rows (in group order) and more counts the rest', () => {
  const base = Array.from({ length: 10 }, (_, i) => `w${i}`);
  const r = wordRows({ base, custom: ['x'], excluded: ['w0'], limit: 4 });
  assert.deepEqual(r.rows.map(x => x.w), ['x', 'w1', 'w2', 'w3']);
  assert.equal(r.total, 11);
  assert.equal(r.more, 7);
  assert.equal(wordRows({ base, limit: 100 }).more, 0);
});

test('wordRows does not touch its inputs', () => {
  const base = ['犬'], custom = ['猫'], excluded = ['犬'];
  wordRows({ base, custom, excluded, q: '犬' });
  assert.deepEqual([base, custom, excluded], [['犬'], ['猫'], ['犬']]);
});

test('newCustom: only words that are neither in base nor already custom are added', () => {
  const r = newCustom(['犬'], ['猫'], ['犬', '猫', '鳥', '鳥', '魚']);
  assert.deepEqual(r, { custom: ['猫', '鳥', '魚'], added: 2 });
  assert.deepEqual(newCustom(['犬'], [], ['犬']), { custom: [], added: 0 });
});
