// raw/wnjpn.db → data/defs/00.json … 3f.json（語 → 意味）  (node --no-warnings tools/build-defs.mjs)
// 対象は data/words.json と data/verbs.json の全語。意味は synset_def の lang='jpn', sid='0'。語に sense が複数あるときは freq の大きい順・rank の順で最初の1つ
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { groupByShard } from '../src/defs.js';

const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);

// rows: [{lemma, def, freq, rank}]、wanted: 対象の語の Set → Map(語 → 意味)。lemma の _ は words.json と同じく取る
export function chooseDefs(rows, wanted) {
  const best = new Map();
  for (const r of rows) {
    const w = r.lemma.replaceAll('_', ''), def = r.def?.trim();
    if (!def || !wanted.has(w)) continue;
    const freq = num(r.freq, 0), rank = num(r.rank, Infinity), b = best.get(w);
    if (!b || freq > b.freq || (freq === b.freq && rank < b.rank)) best.set(w, { def, freq, rank });
  }
  return new Map([...best].map(([w, b]) => [w, b.def]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync('raw/wnjpn.db')) writeFileSync('raw/wnjpn.db', gunzipSync(readFileSync('raw/wnjpn.db.gz')));
  const db = new DatabaseSync('raw/wnjpn.db', { readOnly: true });
  const words = JSON.parse(readFileSync('data/words.json', 'utf8')), verbs = JSON.parse(readFileSync('data/verbs.json', 'utf8'));
  const wanted = new Set([...Object.values(words).flat(), ...verbs]);
  // build-words.mjs と同じ n / v の sense だけ（形容詞などの意味が混ざらないように）
  const rows = db.prepare(
    `SELECT w.lemma, s.freq, s.rank, d.def FROM word w JOIN sense s ON s.wordid=w.wordid JOIN synset y ON y.synset=s.synset
     JOIN synset_def d ON d.synset=s.synset AND d.lang='jpn' AND d.sid='0' WHERE w.lang='jpn' AND y.pos IN ('n','v') ORDER BY w.wordid, s.synset`).all();
  const defs = chooseDefs(rows, wanted);
  mkdirSync('data/defs', { recursive: true });
  for (const f of readdirSync('data/defs')) if (f.endsWith('.json')) rmSync(`data/defs/${f}`);
  const shards = groupByShard(defs);
  let total = 0, min = Infinity, max = 0;
  for (const [name, o] of Object.entries(shards)) {
    writeFileSync(`data/defs/${name}.json`, JSON.stringify(o));
    const size = statSync(`data/defs/${name}.json`).size;
    total += size; min = Math.min(min, size); max = Math.max(max, size);
  }
  console.log(`words ${wanted.size}, with meaning ${defs.size}; files ${Object.keys(shards).length}, total ${total} bytes (min ${min}, max ${max})`);
}
