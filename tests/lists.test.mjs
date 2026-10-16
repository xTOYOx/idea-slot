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
