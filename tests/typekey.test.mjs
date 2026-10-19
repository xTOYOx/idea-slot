import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseType, buildType, toggleType, normalizeType, remapType } from '../src/typekey.js';

test('parseType: plain key is one element, mix: splits on |', () => {
  assert.deepEqual(parseType('verb'), ['verb']);
  assert.deepEqual(parseType('my:海'), ['my:海']);
  assert.deepEqual(parseType('mix:noun:animal|genre|my:宇宙'), ['noun:animal', 'genre', 'my:宇宙']);
  assert.deepEqual(parseType('mix:'), []);
});
test('buildType: 0 → any, 1 → plain key, 2+ → mix:; dedupes; any is dropped from a mix', () => {
  assert.equal(buildType([]), 'any');
  assert.equal(buildType(['verb']), 'verb');
  assert.equal(buildType(['verb', 'verb']), 'verb');
  assert.equal(buildType(['noun:animal', 'genre']), 'mix:noun:animal|genre');
  assert.equal(buildType(['any', 'genre']), 'genre');
  assert.equal(buildType(['any']), 'any');
});
test('build/parse roundtrip survives | and % in theme names', () => {
  const keys = ['my:a|b', 'my:100%', 'verb'];
  assert.deepEqual(parseType(buildType(keys)), keys);
  assert.equal(buildType(['my:a|b']), 'my:a|b'); // single stays raw
});
test('toggleType: add / remove / last one stays / any is exclusive', () => {
  assert.equal(toggleType('noun:animal', 'genre'), 'mix:noun:animal|genre');
  assert.equal(toggleType('mix:noun:animal|genre', 'genre'), 'noun:animal');
  assert.equal(toggleType('mix:noun:animal|genre|verb', 'genre'), 'mix:noun:animal|verb');
  assert.equal(toggleType('verb', 'verb'), 'verb');
  assert.equal(toggleType('any', 'any'), 'any');
  assert.equal(toggleType('any', 'verb'), 'verb');
  assert.equal(toggleType('mix:verb|genre', 'any'), 'any');
});
test('normalizeType drops unknown parts: 0 → any, 1 → plain key', () => {
  const ok = k => ['any', 'verb', 'genre', 'my:海'].includes(k);
  assert.equal(normalizeType('verb', ok), 'verb');
  assert.equal(normalizeType('zzz', ok), 'any');
  assert.equal(normalizeType('mix:verb|my:消えた', ok), 'verb');
  assert.equal(normalizeType('mix:verb|my:海|zzz', ok), 'mix:verb|my:海');
  assert.equal(normalizeType('mix:zzz|yyy', ok), 'any');
  assert.equal(normalizeType('mix:any|verb', ok), 'verb');
  assert.equal(normalizeType('mix:', ok), 'any');
});
test('remapType renames / removes my: parts inside any key', () => {
  assert.equal(remapType('my:海', 'my:海', 'my:川'), 'my:川');
  assert.equal(remapType('mix:verb|my:海', 'my:海', 'my:川'), 'mix:verb|my:川');
  assert.equal(remapType('mix:verb|my:海', 'my:海', null), 'verb');
  assert.equal(remapType('my:海', 'my:海', null), 'any');
  assert.equal(remapType('mix:my:海|my:山', 'my:海', null), 'my:山');
  assert.equal(remapType('verb', 'my:海', null), 'verb');
  assert.equal(remapType('mix:my:海|my:山', 'my:海', 'my:山'), 'my:山');
});
