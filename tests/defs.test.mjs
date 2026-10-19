import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHARDS, shardOf, groupByShard, createDefs } from '../src/defs.js';

test('shardOf: two hex digits 00..3f, the same word always lands in the same file', () => {
  assert.equal(SHARDS, 64);
  for (const w of ['犬', '走る', 'Eメール', 'a', '']) assert.match(shardOf(w), /^[0-3][0-9a-f]$/);
  assert.equal(shardOf('犬'), shardOf('犬'));
});
test('shardOf: spreads words over all 64 files fairly evenly', () => {
  const n = new Map();
  for (let i = 0; i < 20000; i++) { const k = shardOf('語' + i + String.fromCharCode(0x3042 + (i % 80))); n.set(k, (n.get(k) ?? 0) + 1); }
  assert.equal(n.size, 64);
  assert.ok(Math.min(...n.values()) > 200 && Math.max(...n.values()) < 450, [...n.values()].join());
});
test('groupByShard: always 64 files; each word is stored under its own shard, keys sorted', () => {
  const g = groupByShard([['犬', 'いぬ'], ['猫', 'ねこ'], ['あ', 'ア']]);
  assert.equal(Object.keys(g).length, 64);
  const names = Object.keys(g).sort(); // 数字だけの名前（10 など）は先に並ぶので、並べ替えてから見る
  assert.deepEqual(names.slice(0, 2), ['00', '01']);
  assert.equal(names.at(-1), '3f');
  assert.equal(g[shardOf('犬')]['犬'], 'いぬ');
  assert.equal(g[shardOf('猫')]['猫'], 'ねこ');
  assert.equal(Object.values(g).reduce((a, o) => a + Object.keys(o).length, 0), 3);
  const many = groupByShard([['b', 1], ['a', 2], ['c', 3]].map(([w, d]) => [w, String(d)]));
  for (const o of Object.values(many)) assert.deepEqual(Object.keys(o), Object.keys(o).sort());
});

const games = [{ ja: 'テトリス', en: 'Tetris' }];
function make(files) {
  const calls = [];
  const load = async name => { calls.push(name); if (!(name in files)) throw new Error('404'); return files[name]; };
  return { calls, defs: createDefs(load, games) };
}
test('createDefs: loads only the file of the word and keeps it in memory', async () => {
  const { calls, defs } = make({ [shardOf('犬')]: { 犬: 'いぬ科の動物' } });
  assert.equal(await defs.lookup('犬'), 'いぬ科の動物');
  assert.equal(await defs.lookup('犬'), 'いぬ科の動物');
  assert.deepEqual(calls, [shardOf('犬')]);
});
test('createDefs: parallel lookups of one file share a single load', async () => {
  const { calls, defs } = make({ [shardOf('犬')]: { 犬: 'a' } });
  await Promise.all([defs.lookup('犬'), defs.lookup('犬')]);
  assert.equal(calls.length, 1);
});
test('createDefs: a word without a meaning is null (also names that only look like object keys)', async () => {
  const { defs } = make({ [shardOf('猫')]: {}, [shardOf('constructor')]: {}, [shardOf('__proto__')]: {} });
  assert.equal(await defs.lookup('猫'), null);
  assert.equal(await defs.lookup('constructor'), null);
  assert.equal(await defs.lookup('__proto__'), null);
});
test('createDefs: a game title gives its English title (after the meaning when the word also has one)', async () => {
  assert.equal(await make({}).defs.lookup('テトリス'), '英題: Tetris');
  assert.equal(await make({ [shardOf('テトリス')]: { テトリス: '落ち物パズル' } }).defs.lookup('テトリス'), '落ち物パズル\n英題: Tetris');
});
test('createDefs: a failed load gives null and is retried next time', async () => {
  const files = {};
  const { calls, defs } = make(files);
  assert.equal(await defs.lookup('犬'), null);
  files[shardOf('犬')] = { 犬: 'いぬ' };
  assert.equal(await defs.lookup('犬'), 'いぬ');
  assert.equal(calls.length, 2);
});
test('createDefs: empty or missing word is null', async () => {
  const { calls, defs } = make({});
  assert.equal(await defs.lookup(''), null);
  assert.equal(await defs.lookup(null), null);
  assert.deepEqual(calls, []);
});
