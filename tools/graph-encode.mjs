// WordNet の名詞 synset とつながりを、アプリ用の軽い graph に詰める（純粋関数）。
const FIELD = { hypo: 'hypo', mprt: 'part', mmem: 'memb', msub: 'subs', inst: 'inst', dmnc: 'dom' };

export function encodeGraph({ synsets, links }, keepLemma) {
  const index = new Map(synsets.map((s, i) => [s.id, i]));
  const g = { v: 1, syn: synsets.map((s) => [...new Set(s.lemmas.map((l) => l.replaceAll('_', '')).filter(keepLemma))]) };
  for (const f of Object.values(FIELD)) g[f] = [];
  for (const { from, to, link } of links) {
    if (FIELD[link] && index.has(from) && index.has(to)) g[FIELD[link]].push(index.get(from), index.get(to));
  }
  return g;
}
