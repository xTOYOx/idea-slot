// raw/wnjpn.db → data/graph.json  (node --no-warnings tools/build-graph.mjs)
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, statSync } from 'node:fs';
import { keepLemma } from './categorize.mjs';
import { encodeGraph } from './graph-encode.mjs';

const db = new DatabaseSync('raw/wnjpn.db', { readOnly: true });
const lemmas = new Map();
for (const { synset, lemma } of db.prepare(
  "SELECT s.synset, w.lemma FROM sense s JOIN word w ON w.wordid=s.wordid WHERE w.lang='jpn' AND s.synset LIKE '%-n' ORDER BY s.synset, s.rank"
).all()) {
  if (!lemmas.has(synset)) lemmas.set(synset, []);
  lemmas.get(synset).push(lemma);
}
const synsets = db.prepare("SELECT synset FROM synset WHERE pos='n' ORDER BY synset").all()
  .map(({ synset }) => ({ id: synset, lemmas: lemmas.get(synset) ?? [] }));
const links = db.prepare(
  "SELECT synset1 AS \"from\", synset2 AS \"to\", link FROM synlink WHERE link IN ('hypo','mprt','mmem','msub','inst','dmnc')"
).all();

const g = encodeGraph({ synsets, links }, keepLemma);
writeFileSync('data/graph.json', JSON.stringify(g));
const n = (k) => g[k].length / 2;
console.log('synsets', g.syn.length, 'with words', g.syn.filter((a) => a.length).length);
console.log('links hypo', n('hypo'), 'part', n('part'), 'memb', n('memb'), 'subs', n('subs'), 'inst', n('inst'), 'dom', n('dom'));
console.log('uchuu synsets', g.syn.filter((a) => a.includes('宇宙')).length);
console.log('graph.json', statSync('data/graph.json').size, 'bytes');
