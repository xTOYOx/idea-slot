import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categorize, keepLemma } from '../tools/categorize.mjs';

// 小さな上位語グラフ: dog → canine → animal(root) / chair → seat → furniture → artifact(root)
// house → building → structure(root place) → artifact(root tool)
const h = new Map([
  ['dog', ['canine']], ['canine', ['00015388-n']],
  ['chair', ['seat']], ['seat', ['furniture']], ['furniture', ['00021939-n']],
  ['house', ['building']], ['building', ['04341686-n']], ['04341686-n', ['00021939-n']],
]);

test('nearest root wins', () => {
  assert.equal(categorize('dog', h), 'animal');
  assert.equal(categorize('chair', h), 'tool');
  assert.equal(categorize('house', h), 'place');   // structure is closer than artifact
});
test('no root → other', () => assert.equal(categorize('lonely', h), 'other'));
test('cycle does not hang', () => {
  const c = new Map([['a', ['b']], ['b', ['a']]]);
  assert.equal(categorize('a', c), 'other');
});
test('keepLemma', () => {
  assert.equal(keepLemma('カワウソ'), true);
  assert.equal(keepLemma('犬'), true);       // 漢字1文字は残す
  assert.equal(keepLemma('ア'), false);      // かな1文字は除く
  assert.equal(keepLemma('ー'), false);
  assert.equal(keepLemma('・・'), false);    // 記号だけ
});
