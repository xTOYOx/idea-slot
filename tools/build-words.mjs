// raw/wnjpn.db.gz → data/words.json, data/verbs.json  (node tools/build-words.mjs)
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { ROOTS, categorize, keepLemma } from './categorize.mjs';

if (!existsSync('raw/wnjpn.db')) writeFileSync('raw/wnjpn.db', gunzipSync(readFileSync('raw/wnjpn.db.gz')));
const db = new DatabaseSync('raw/wnjpn.db', { readOnly: true });

let bad = 0;
for (const r of ROOTS) {
  const row = db.prepare('SELECT name FROM synset WHERE synset=?').get(r.id);
  if (row?.name !== r.name) { console.error(`ROOT mismatch: ${r.cat} ${r.id} expected ${r.name}, got ${row?.name}`); bad = 1; }
}
if (bad) process.exit(1);

const hypernyms = new Map();
for (const { synset1, synset2 } of db.prepare("SELECT synset1, synset2 FROM synlink WHERE link='hype'").all()) {
  if (!hypernyms.has(synset1)) hypernyms.set(synset1, []);
  hypernyms.get(synset1).push(synset2);
}

const rows = db.prepare(
  "SELECT w.lemma, s.synset, y.pos FROM word w JOIN sense s ON s.wordid=w.wordid JOIN synset y ON y.synset=s.synset WHERE w.lang='jpn' AND y.pos IN ('n','v')"
).all();

const words = Object.fromEntries([...new Set(ROOTS.map((r) => r.cat)), 'other'].map((c) => [c, new Set()]));
const verbs = new Set();
for (const { lemma, synset, pos } of rows) {
  const w = lemma.replaceAll('_', '');
  if (!keepLemma(w)) continue;
  if (pos === 'v') verbs.add(w);
  else words[categorize(synset, hypernyms)].add(w);
}

const out = Object.fromEntries(Object.entries(words).map(([c, s]) => [c, [...s].sort()]));
writeFileSync('data/words.json', JSON.stringify(out));
writeFileSync('data/verbs.json', JSON.stringify([...verbs].sort()));
let total = 0;
for (const [c, a] of Object.entries(out)) { console.log(c, a.length); total += a.length; }
console.log('noun total', total, 'verbs', verbs.size);
console.log('words.json', statSync('data/words.json').size, 'bytes; verbs.json', statSync('data/verbs.json').size, 'bytes');
