const NOUN_KEYS = ['animal', 'plant', 'food', 'person', 'place', 'tool', 'nature', 'body', 'feeling', 'event', 'abstract', 'other'];
const TAG_KEYS = ['look', 'mood', 'mechanic'];

// 種類キー（'noun:animal' / 'verb' / 'tag:look' …）の元の語。まとめの種類（noun / tag / any）と自作テーマは空
export function baseWords(data, key) {
  if (key === 'verb') return data.verbs;
  if (key === 'genre') return data.genres.map(g => g.ja);
  if (key === 'game') return data.games.map(g => g.ja); // 作品名。any（全部ランダム）には入れない
  const [kind, sub] = key.split(':');
  if (kind === 'noun') return data.words[sub] ?? [];
  if (kind === 'tag') return (data.tags[sub] ?? []).map(t => t.ja);
  return [];
}

export function buildPools(data, custom = {}, excluded = []) {
  const drop = new Set(excluded);
  const make = (base, key) => [...new Set([...base, ...(custom[key] ?? [])])].filter(w => !drop.has(w));
  const union = (keys) => make(keys.flatMap(k => pools[k]), '');
  const pools = {};
  const keys = [...NOUN_KEYS.map(k => `noun:${k}`), 'verb', 'genre', 'game', ...TAG_KEYS.map(k => `tag:${k}`)];
  for (const k of keys) pools[k] = make(baseWords(data, k), k);
  pools.noun = union(NOUN_KEYS.map(k => `noun:${k}`));
  pools.tag = union(TAG_KEYS.map(k => `tag:${k}`));
  pools.any = union(['noun', 'verb', 'genre', 'tag']);
  return pools;
}
