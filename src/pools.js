const NOUN_KEYS = ['animal', 'plant', 'food', 'person', 'place', 'tool', 'nature', 'body', 'feeling', 'event', 'abstract', 'other'];
const TAG_KEYS = ['look', 'mood', 'mechanic'];

export function buildPools(data, custom = {}, excluded = []) {
  const drop = new Set(excluded);
  const make = (base, key) => [...new Set([...base, ...(custom[key] ?? [])])].filter(w => !drop.has(w));
  const union = (keys) => make(keys.flatMap(k => pools[k]), '');
  const pools = {};
  for (const k of NOUN_KEYS) pools[`noun:${k}`] = make(data.words[k] ?? [], `noun:${k}`);
  pools.verb = make(data.verbs, 'verb');
  pools.genre = make(data.genres.map(g => g.ja), 'genre');
  pools.game = make(data.games.map(g => g.ja), 'game'); // 作品名。any（全部ランダム）には入れない
  for (const k of TAG_KEYS) pools[`tag:${k}`] = make((data.tags[k] ?? []).map(t => t.ja), `tag:${k}`);
  pools.noun = union(NOUN_KEYS.map(k => `noun:${k}`));
  pools.tag = union(TAG_KEYS.map(k => `tag:${k}`));
  pools.any = union(['noun', 'verb', 'genre', 'tag']);
  return pools;
}
