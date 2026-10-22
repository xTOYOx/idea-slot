import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load = p => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url)));
const ok = it => typeof it.ja === 'string' && it.ja && typeof it.en === 'string' && it.en;

test('genres: 80-150 items, shape, no duplicate ja', () => {
  const g = load('genres.json');
  assert.ok(g.length >= 80 && g.length <= 150, `count ${g.length}`);
  assert.ok(g.every(ok));
  assert.equal(new Set(g.map(x => x.ja)).size, g.length);
});
test('tags: 3 groups, 250-400 total, no duplicate ja across groups', () => {
  const t = load('tags.json');
  assert.deepEqual(Object.keys(t).sort(), ['look', 'mechanic', 'mood']);
  const all = Object.values(t).flat();
  assert.ok(all.length >= 250 && all.length <= 400, `count ${all.length}`);
  assert.ok(all.every(ok));
  assert.equal(new Set(all.map(x => x.ja)).size, all.length);
});
test('genres and tags share no ja', () => {
  const g = new Set(load('genres.json').map(x => x.ja));
  const dup = Object.values(load('tags.json')).flat().filter(x => g.has(x.ja)).map(x => x.ja);
  assert.deepEqual(dup, []);
});
test('no blocked word (tools/blocked.txt) is left in any data list', async () => {
  const { BLOCKED } = await import('../tools/categorize.mjs');
  const all = [...Object.values(load('words.json')).flat(), ...load('verbs.json'), ...load('genres.json').map(x => x.ja),
    ...Object.values(load('tags.json')).flat().map(x => x.ja), ...Object.values(load('extra.json')).flat()];
  assert.ok(BLOCKED.size > 100);
  assert.deepEqual(all.filter(w => BLOCKED.has(w)), []);
});
