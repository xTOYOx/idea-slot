import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeGraph } from '../tools/graph-encode.mjs';
import { keepLemma } from '../tools/categorize.mjs';
const synsets = [{ id: 'a-n', lemmas: ['宇宙', '大_宇宙'] }, { id: 'b-n', lemmas: ['銀河', 'ア'] }, { id: 'c-n', lemmas: [] }, { id: 'd-n', lemmas: ['天文学'] }];
const links = [
  { from: 'a-n', to: 'b-n', link: 'mmem' }, { from: 'a-n', to: 'c-n', link: 'hypo' },
  { from: 'b-n', to: 'd-n', link: 'dmnc' }, { from: 'a-n', to: 'zz-n', link: 'hypo' }, { from: 'a-n', to: 'b-n', link: 'sim' },
];
test('encodes lemmas, links and drops unknown', () => {
  const g = encodeGraph({ synsets, links }, keepLemma);
  assert.equal(g.v, 1);
  assert.deepEqual(g.syn, [['宇宙', '大宇宙'], ['銀河'], [], ['天文学']]);
  assert.deepEqual(g.memb, [0, 1]);
  assert.deepEqual(g.hypo, [0, 2]);
  assert.deepEqual(g.dom, [1, 3]);
  assert.deepEqual([g.part, g.subs, g.inst], [[], [], []]);
});
test('inst comes from hasi (class -> instance); raw inst dropped', () => {
  const ss = [{ id: 'a-n', lemmas: ['河川'] }, { id: 'b-n', lemmas: ['ナイル川'] }];
  assert.deepEqual(encodeGraph({ synsets: ss, links: [{ from: 'a-n', to: 'b-n', link: 'hasi' }] }, keepLemma).inst, [0, 1]);
  assert.deepEqual(encodeGraph({ synsets: ss, links: [{ from: 'b-n', to: 'a-n', link: 'inst' }] }, keepLemma).inst, []);
});
