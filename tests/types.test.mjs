import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPE_KEYS, TYPE_LABELS, typeGroups, MY } from '../src/types.js';
test('type keys order and labels', () => {
  assert.equal(TYPE_KEYS.length, 21);
  assert.deepEqual(TYPE_KEYS.slice(0, 3), ['any', 'noun', 'noun:animal']);
  assert.equal(TYPE_KEYS.at(-1), 'tag:mechanic');
  assert.equal(TYPE_KEYS[TYPE_KEYS.indexOf('genre') + 1], 'game');
  assert.equal(TYPE_LABELS.game, 'ゲーム');
  assert.equal(TYPE_LABELS['tag:look'], 'タグ：見た目');
});

test('typeGroups: grouped for the picker panel, every type key exactly once', () => {
  const g = typeGroups([]);
  assert.deepEqual(g.map(x => x.title), [null, '単語', 'その他の種類', 'タグ']);
  assert.deepEqual(g[0].items, [{ k: 'any', text: '全部ランダム' }]);
  assert.deepEqual(g[1].items.map(x => x.k).slice(0, 3), ['noun', 'noun:animal', 'noun:plant']);
  assert.equal(g[1].items.length, 13);
  assert.deepEqual(g[2].items.map(x => x.text), ['動詞', 'ゲームジャンル', 'ゲーム']);
  assert.deepEqual(g[3].items.map(x => x.text), ['タグ（全部）', '見た目', '雰囲気・テーマ', '仕組み']);
  assert.deepEqual(g.flatMap(x => x.items.map(i => i.k)).sort(), [...TYPE_KEYS].sort());
});
test('typeGroups: my themes get their own group only when there are some', () => {
  const g = typeGroups([{ name: '海', words: ['a', 'b'] }]);
  assert.equal(g.length, 5);
  assert.equal(g[4].title, '自分のテーマ');
  assert.deepEqual(g[4].items, [{ k: MY + '海', text: '★海（2語）' }]);
});
