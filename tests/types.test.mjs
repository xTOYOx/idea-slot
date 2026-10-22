import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPE_KEYS, TYPE_LABELS, typeGroups, MY } from '../src/types.js';
test('type keys order and labels', () => {
  assert.equal(TYPE_KEYS.length, 42);
  assert.deepEqual(TYPE_KEYS.slice(0, 3), ['any', 'noun', 'noun:animal']);
  assert.equal(TYPE_KEYS.at(-1), 'tag:mechanic');
  assert.equal(TYPE_KEYS[TYPE_KEYS.indexOf('genre') + 1], 'extra');
  assert.equal(TYPE_KEYS[TYPE_KEYS.indexOf('tag') - 1], 'extra:ng');
  assert.equal(TYPE_LABELS.extra, 'テーマ集（全部）');
  assert.equal(TYPE_LABELS['extra:ono'], 'オノマトペ');
  assert.equal(TYPE_LABELS['extra:rule'], '制約');
  assert.equal(TYPE_LABELS['tag:look'], 'タグ：見た目');
});

test('typeGroups: grouped for the picker panel, every type key exactly once (as an item or as a group all)', () => {
  const g = typeGroups([]);
  assert.deepEqual(g.map(x => x.title), [null, '単語', 'その他の種類', 'テーマ集', 'タグ']);
  assert.deepEqual(g[0].items, [{ k: 'any', text: '全部ランダム' }]);
  assert.deepEqual(g[1].items.map(x => x.k).slice(0, 2), ['noun:animal', 'noun:plant']);
  assert.equal(g[1].items.length, 12);
  assert.equal(g[1].all, 'noun');
  assert.deepEqual(g[1].members, g[1].items.map(x => x.k));
  assert.equal(g[2].all, undefined);
  assert.deepEqual(g[2].members, ['verb', 'genre']);
  assert.deepEqual(g[2].items.map(x => x.text), ['動詞', 'ゲームジャンル']);
  assert.equal(g[3].items.length, 21);
  assert.deepEqual(g[3].items.slice(0, 2), [{ k: 'extra:ono', text: 'オノマトペ' }, { k: 'extra:jfood', text: '日本の食べ物' }]);
  assert.deepEqual(g[3].items.at(-1), { k: 'extra:ng', text: 'NG語' });
  assert.equal(g[3].all, 'extra');
  assert.equal(g[3].members.length, 16); // 目標・ルール・カタルシス・制約・NG語は見出しのチェックに含めない
  assert.ok(!g[3].members.includes('extra:rule') && !g[3].members.includes('extra:ng'));
  assert.deepEqual(g[4].items.map(x => x.text), ['見た目', '雰囲気・テーマ', '遊び方']);
  assert.equal(g[4].all, 'tag');
  assert.equal(g[0].members, undefined);
  assert.deepEqual([...g.flatMap(x => x.items.map(i => i.k)), ...g.flatMap(x => x.all ?? [])].sort(), [...TYPE_KEYS].sort());
});
test('typeGroups: my themes get their own group only when there are some', () => {
  const g = typeGroups([{ name: '海', words: ['a', 'b'] }]);
  assert.equal(g.length, 6);
  assert.equal(g[5].title, '自分のテーマ');
  assert.deepEqual(g[5].items, [{ k: MY + '海', text: '★海（2語）' }]);
  assert.deepEqual(g[5].members, [MY + '海']);
  assert.equal(g[5].all, undefined);
});
