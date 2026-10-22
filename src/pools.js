import { EXTRA, EXTRA_ONLY, NG } from './types.js';
const NOUN_KEYS = ['animal', 'plant', 'food', 'person', 'place', 'tool', 'nature', 'body', 'feeling', 'event', 'abstract', 'other'];
const TAG_KEYS = ['look', 'mood', 'mechanic'];
const EXTRA_KEYS = Object.keys(EXTRA);

// 種類キー（'noun:animal' / 'verb' / 'tag:look' / 'extra:ono' …）の元の語。まとめの種類（noun / tag / extra / any）と自作テーマは空。
// NG語（data.extra.ng）は NG のテーマにだけ入れ、ほかの種類からは外す
export function baseWords(data, key) {
  const all = rawWords(data, key), ng = data.extra?.ng;
  if (key === NG || !ng?.length) return all;
  const drop = new Set(ng);
  return all.filter(w => !drop.has(w));
}
function rawWords(data, key) {
  if (key === 'verb') return data.verbs;
  if (key === 'genre') return data.genres.map(g => g.ja);
  const [kind, sub] = key.split(':');
  if (kind === 'noun') return data.words[sub] ?? [];
  if (kind === 'extra') return data.extra?.[sub] ?? [];
  if (kind === 'tag') return (data.tags[sub] ?? []).map(t => t.ja);
  return [];
}

export function buildPools(data, custom = {}, excluded = []) {
  const drop = new Set(excluded);
  const make = (base, key) => [...new Set([...base, ...(custom[key] ?? [])])].filter(w => !drop.has(w));
  const union = (keys) => make(keys.flatMap(k => pools[k]), '');
  const pools = {};
  const keys = [...NOUN_KEYS.map(k => `noun:${k}`), 'verb', 'genre', ...EXTRA_KEYS.map(k => `extra:${k}`), ...TAG_KEYS.map(k => `tag:${k}`)];
  for (const k of keys) pools[k] = make(baseWords(data, k), k);
  pools.noun = union(NOUN_KEYS.map(k => `noun:${k}`));
  pools.extra = union(EXTRA_KEYS.filter(k => !EXTRA_ONLY.includes(k)).map(k => `extra:${k}`));
  pools.tag = union(TAG_KEYS.map(k => `tag:${k}`));
  pools.any = union(['noun', 'verb', 'genre', 'tag', 'extra']);
  return pools;
}
