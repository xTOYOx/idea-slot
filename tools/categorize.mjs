// 上位語グラフをたどって名詞を小分類に振り分ける。ROOTS の並びは同段の優先順。
import { readFileSync } from 'node:fs';

// 完全に外す語（tools/blocked.txt。# で始まる行は説明）
export const BLOCKED = new Set(readFileSync(new URL('./blocked.txt', import.meta.url), 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')));
export const ROOTS = [
  { cat: 'animal', id: '00015388-n', name: 'animate_being' },
  { cat: 'plant', id: '00017222-n', name: 'flora' },
  { cat: 'food', id: '00021265-n', name: 'food' },
  { cat: 'food', id: '07555863-n', name: 'food' },
  { cat: 'food', id: '07881800-n', name: 'drink' },
  { cat: 'person', id: '00007846-n', name: 'individual' },
  { cat: 'place', id: '00027167-n', name: 'location' },
  { cat: 'place', id: '04341686-n', name: 'structure' },
  { cat: 'tool', id: '00021939-n', name: 'artefact' },
  { cat: 'nature', id: '11408559-n', name: 'natural_phenomenon' },
  { cat: 'nature', id: '00019128-n', name: 'natural_object' },
  { cat: 'body', id: '05220461-n', name: 'body_part' },
  { cat: 'feeling', id: '00026192-n', name: 'feeling' },
  { cat: 'feeling', id: '00024720-n', name: 'state' },
  { cat: 'event', id: '00029378-n', name: 'event' },
  { cat: 'abstract', id: '00002137-n', name: 'abstract_entity' },
];

const rank = new Map(ROOTS.map((r, i) => [r.id, i]));

export function categorize(synsetId, hypernyms) {
  if (rank.has(synsetId)) return ROOTS[rank.get(synsetId)].cat;
  const seen = new Set([synsetId]);
  let level = [synsetId];
  while (level.length) {
    const next = [];
    for (const id of level) {
      for (const p of hypernyms.get(id) ?? []) {
        if (!seen.has(p)) { seen.add(p); next.push(p); }
      }
    }
    const hits = next.filter((id) => rank.has(id));
    if (hits.length) return ROOTS[Math.min(...hits.map((id) => rank.get(id)))].cat;
    level = next;
  }
  return 'other';
}

export function keepLemma(lemma) {
  if (BLOCKED.has(lemma)) return false;
  if (/^[\x00-\x7f]*$/.test(lemma) || /\s/.test(lemma)) return false; // ASCIIだけ・空白入りは除く
  const s = lemma.replace(/[\p{P}\p{S}\p{Z}ー・〜～]/gu, '');
  if (!s) return false;
  return !(s.length === 1 && /[぀-ヿ]/.test(s));
}
