import { TYPE_KEYS } from './types.js';

// 固定順: noun:* → verb → genre → game → tag:*（和集合キー noun/tag/any は使わない）
const keysOf = prefix => TYPE_KEYS.filter(k => k.startsWith(prefix));
const INDEX_KEYS = [...keysOf('noun:'), 'verb', 'genre', 'game', ...keysOf('tag:')];

// extra: 辞書の語のあとに足す [{w, label}]（自作テーマの語など）。重複は先のものを優先
export function buildIndex(pools, labels, extra = []) {
  const seen = new Set();
  const out = [];
  for (const key of INDEX_KEYS) {
    for (const w of pools[key] ?? []) {
      if (seen.has(w)) continue;
      seen.add(w);
      out.push({ w, label: labels[key] });
    }
  }
  for (const x of extra) {
    if (seen.has(x.w)) continue;
    seen.add(x.w);
    out.push(x);
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
