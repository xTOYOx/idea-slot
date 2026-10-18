import { TYPE_KEYS } from './types.js';

// 固定順: noun:* → verb → genre → tag:*（和集合キー noun/tag/any は使わない）
const keysOf = prefix => TYPE_KEYS.filter(k => k.startsWith(prefix));
const INDEX_KEYS = [...keysOf('noun:'), 'verb', 'genre', ...keysOf('tag:')];

export function buildIndex(pools, labels) {
  const seen = new Set();
  const out = [];
  for (const key of INDEX_KEYS) {
    for (const w of pools[key] ?? []) {
      if (seen.has(w)) continue;
      seen.add(w);
      out.push({ w, label: labels[key] });
    }
  }
  return out;
}

export function searchWords(index, q, limit = 50) {
  q = q.trim();
  if (!q) return [];
  const exact = index.filter(x => x.w === q);
  const prefix = index.filter(x => x.w !== q && x.w.startsWith(q));
  const part = index.filter(x => !x.w.startsWith(q) && x.w.includes(q));
  return [...exact, ...prefix, ...part].slice(0, limit);
}
