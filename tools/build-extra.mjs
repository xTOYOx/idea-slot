// tools/extra/<id>.txt（1行1語）→ data/extra.json  (node tools/build-extra.mjs)
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { EXTRA } from '../src/types.js';

const MAX_LEN = 16; // この長さ以上の行は語として長すぎるので捨てる

// 1ファイルぶんの文章 → 整えた語のリスト。前後の空白を除き、NFC にそろえ、空行と重複を捨てる
export function tidyWords(text) {
  const words = new Set(), long = [];
  for (const line of text.split(/\r?\n/)) {
    const w = line.trim().normalize('NFC');
    if (!w) continue;
    if ([...w].length >= MAX_LEN) long.push(w); else words.add(w);
  }
  return { words: [...words], long };
}

// texts: {id: ファイルの文章}（あるものだけ）→ { data: {id: [語]}（EXTRA の順）, warnings }。知らない id はエラー
export function buildExtra(texts) {
  const unknown = Object.keys(texts).filter(id => !(id in EXTRA));
  if (unknown.length) throw new Error(`知らないテーマ id: ${unknown.join(', ')}`);
  const data = {}, warnings = [];
  for (const id of Object.keys(EXTRA)) {
    if (!(id in texts)) { warnings.push(`${id}: ファイルがありません（空にします）`); data[id] = []; continue; }
    const { words, long } = tidyWords(texts[id]);
    for (const w of long) warnings.push(`${id}: ${MAX_LEN}文字以上の行を捨てました「${w}」`);
    data[id] = words;
  }
  return { data, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = 'tools/extra', texts = {};
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith('.txt')) texts[f.slice(0, -4)] = readFileSync(`${dir}/${f}`, 'utf8');
  const { data, warnings } = buildExtra(texts);
  writeFileSync('data/extra.json', JSON.stringify(data));
  for (const w of warnings) console.warn('warn', w);
  for (const [id, list] of Object.entries(data)) console.log(id, list.length);
}
