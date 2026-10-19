import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tidyWords, buildExtra } from '../tools/build-extra.mjs';
import { EXTRA } from '../src/types.js';

test('tidyWords: trims, NFC, drops blanks and duplicates, keeps order', () => {
  const r = tidyWords('  ふわふわ \n\nきらきら\r\nふわふわ\n\t\nが');
  assert.deepEqual(r.words, ['ふわふわ', 'きらきら', 'が']); // か + 濁点 → が (NFC)
  assert.deepEqual(r.long, []);
});
test('tidyWords: lines of 16+ characters are dropped and reported; 15 is kept', () => {
  const ok = 'あ'.repeat(15), ng = 'い'.repeat(16);
  const r = tidyWords(`${ok}\n${ng}\n短い`);
  assert.deepEqual(r.words, [ok, '短い']);
  assert.deepEqual(r.long, [ng]);
});
test('buildExtra: every theme in order; a missing file is an empty list with a warning', () => {
  const { data, warnings } = buildExtra({ jfood: 'すし\nそば', ono: 'ぽよぽよ' });
  assert.deepEqual(Object.keys(data), Object.keys(EXTRA));
  assert.deepEqual(Object.keys(data).slice(0, 3), ['ono', 'jfood', 'jlife']);
  assert.deepEqual(data.ono, ['ぽよぽよ']);
  assert.deepEqual(data.jfood, ['すし', 'そば']);
  assert.deepEqual(data.jlife, []);
  assert.equal(warnings.filter(w => w.includes('jlife')).length, 1);
  assert.equal(warnings.some(w => w.includes('ono')), false);
});
test('buildExtra: a long line produces a warning', () => {
  const { data, warnings } = buildExtra({ ono: 'あ'.repeat(16) });
  assert.deepEqual(data.ono, []);
  assert.ok(warnings.some(w => w.includes('ono') && w.includes('16')));
});
test('buildExtra: an unknown id is an error', () => {
  assert.throws(() => buildExtra({ nope: 'x' }), /nope/);
});
