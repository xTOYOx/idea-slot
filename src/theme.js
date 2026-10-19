// WordNet の語のつながり（data/graph.json）から、テーマの語を集める。
const pairs = (a, f) => { for (let i = 0; i < a.length; i += 2) f(a[i], a[i + 1]); };

export function indexGraph(graph) {
  const n = graph.syn.length;
  const mk = () => Array.from({ length: n }, () => []);
  const G = { syn: graph.syn, down: mk(), up: mk(), kids: mk(), domOf: mk(), domMembers: mk(), byWord: new Map() };
  for (const k of ['hypo', 'part', 'memb', 'subs', 'inst']) pairs(graph[k], (a, b) => G.down[a].push(b));
  pairs(graph.hypo, (a, b) => { G.up[b].push(a); G.kids[a].push(b); });
  pairs(graph.dom, (a, d) => { G.domOf[a].push(d); G.domMembers[d].push(a); });
  graph.syn.forEach((words, i) => words.forEach((w) => {
    if (!G.byWord.has(w)) G.byWord.set(w, []);
    G.byWord.get(w).push(i);
  }));
  return G;
}

// 出発点から深さ D まで幅優先。分野（dom）は「進む」で+1、「その語を拾う」で+1、拾った語からはたどらない。
function collect(G, starts, D) {
  const out = [];
  const seen = new Set(starts), domSeen = new Set();
  let queue = starts.map((id) => ({ id, kind: 'node' }));
  for (let d = 0; queue.length; d++) {
    const next = [];
    for (const { id, kind } of queue) {
      if (d > 0) out.push(...G.syn[id]);
      if (d === D) continue;
      if (kind === 'node') {
        for (const b of G.down[id]) if (!seen.has(b)) { seen.add(b); next.push({ id: b, kind: 'node' }); }
        for (const dm of G.domOf[id]) if (!domSeen.has(dm)) { domSeen.add(dm); next.push({ id: dm, kind: 'domain' }); }
      } else if (kind === 'domain') {
        for (const m of G.domMembers[id]) next.push({ id: m, kind: 'member' });
      }
    }
    queue = next;
  }
  return out;
}

export function themeWords(G, word, { min = 20, excluded = [] } = {}) {
  const starts = G.byWord.get(word);
  if (!starts) return [];
  const drop = new Set([word, ...excluded, ...starts.flatMap((id) => G.syn[id])]);
  const finish = (words) => [...new Set(words)].filter((w) => !drop.has(w));
  let words;
  for (const D of [3, 4, 5]) {
    words = finish(collect(G, starts, D));
    if (words.length >= min) return words;
  }
  const sibs = starts.flatMap((id) => G.up[id].flatMap((p) => G.kids[p]));
  return finish([...words, ...sibs.flatMap((id) => G.syn[id])]);
}
