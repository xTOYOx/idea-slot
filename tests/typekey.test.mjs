import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseType, buildType, toggleType, normalizeType, remapType, checkedKeys, groupState, toggleGroup } from '../src/typekey.js';

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
test('toggleType: add / remove / removing the last one goes back to any / any is exclusive', () => {
  assert.equal(toggleType('noun:animal', 'genre'), 'mix:noun:animal|genre');
  assert.equal(toggleType('mix:noun:animal|genre', 'genre'), 'noun:animal');
  assert.equal(toggleType('mix:noun:animal|genre|verb', 'genre'), 'mix:noun:animal|verb');
  assert.equal(toggleType('verb', 'verb'), 'any');
  assert.equal(toggleType('extra:ng', 'extra:ng'), 'any');
  assert.equal(toggleType('any', 'any'), 'any');
  assert.equal(toggleType('any', 'verb'), 'verb');
  assert.equal(toggleType('mix:verb|genre', 'any'), 'any');
});
const N = { title: '単語', all: 'noun', members: ['noun:a', 'noun:b', 'noun:c'] }, V = { title: 'その他', members: ['verb', 'genre'] }, G = [N, V];
test('checkedKeys: an aggregate key checks its members', () => {
  assert.deepEqual([...checkedKeys(['noun', 'verb'], G)].sort(), ['noun', 'noun:a', 'noun:b', 'noun:c', 'verb']);
  assert.deepEqual([...checkedKeys(['noun:a'], G)], ['noun:a']);
});
test('groupState: true / false / mixed', () => {
  assert.equal(groupState(['noun'], N), 'true');
  assert.equal(groupState(['noun:a', 'noun:b', 'noun:c'], N), 'true');
  assert.equal(groupState(['noun:a'], N), 'mixed');
  assert.equal(groupState(['verb'], N), 'false');
  assert.equal(groupState(['any'], V), 'false');
  assert.equal(groupState(['verb', 'genre'], V), 'true');
  assert.equal(groupState(['verb'], V), 'mixed');
});
test('toggleGroup: check all (aggregate if any), uncheck all, keep other keys, empty → any', () => {
  assert.equal(toggleGroup('any', N), 'noun');
  assert.equal(toggleGroup('verb', N), 'mix:verb|noun');
  assert.equal(toggleGroup('mix:noun:a|verb', N), 'mix:verb|noun'); // 一部 → 全部（個別はまとめに置き換わる）
  assert.equal(toggleGroup('noun', N), 'any');
  assert.equal(toggleGroup('mix:noun|verb', N), 'verb');
  assert.equal(toggleGroup('mix:noun:a|noun:b|noun:c|verb', N), 'verb');
  assert.equal(toggleGroup('any', V), 'mix:verb|genre'); // まとめが無ければ個別に全部
  assert.equal(toggleGroup('mix:verb|genre', V), 'any');
  assert.equal(toggleGroup('mix:verb|noun:a', V), 'mix:noun:a|verb|genre');
});
test('toggleType with groups: expand the aggregate on removal, collapse when all members are picked', () => {
  assert.equal(toggleType('noun', 'noun:b', G), 'mix:noun:a|noun:c');
  assert.equal(toggleType('mix:noun|verb', 'noun:a', G), 'mix:verb|noun:b|noun:c');
  assert.equal(toggleType('mix:noun:a|noun:b', 'noun:c', G), 'noun');
  assert.equal(toggleType('mix:noun:a|noun:b|verb', 'noun:c', G), 'mix:verb|noun');
  assert.equal(toggleType('verb', 'noun:a', G), 'mix:verb|noun:a');
  assert.equal(toggleType('mix:verb|genre', 'verb', G), 'genre');
  assert.equal(toggleType('any', 'noun:a', G), 'noun:a');
  assert.equal(toggleType('noun:a', 'noun:a', G), 'any');
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
