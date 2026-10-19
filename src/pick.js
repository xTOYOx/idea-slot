import { parseType } from './typekey.js';

// 使用済みでない語を1つ選ぶ。まずランダムに最大50回引き直し、だめなら絞り込む
function pickFrom(pool = [], used, rng) {
  for (let i = 0; i < 50; i++) {
    const w = pool[Math.floor(rng() * pool.length)];
    if (w !== undefined && !used.has(w)) return w;
  }
  const rest = pool.filter(w => !used.has(w));
  return rest.length ? rest[Math.floor(rng() * rest.length)] : null;
}

const GROUPS = ['noun', 'verb', 'genre', 'tag'];

// 'any' は4グループ、'mix:…' は選んだ種類から、先に等確率で1つ選んでその語を引く。空/使用済みなら他の種類へ順に
export function pickWord(pools, type, used, rng) {
  const kinds = type === 'any' ? GROUPS : parseType(type);
  if (kinds.length === 1) return pickFrom(pools[kinds[0]], used, rng);
  const start = Math.floor(rng() * kinds.length);
  for (let k = 0; k < kinds.length; k++) {
    const w = pickFrom(pools[kinds[(start + k) % kinds.length]], used, rng);
    if (w) return w;
  }
  return null;
}

export function spin(slots, pools, rng = Math.random) {
  const used = new Set(slots.filter(s => s.held && s.value).map(s => s.value));
  return slots.map(s => {
    if (s.held) return { ...s };
    const value = pickWord(pools, s.type, used, rng);
    if (value) used.add(value);
    return { ...s, value };
  });
}

export function rerollOne(slots, i, pools, rng = Math.random) {
  const used = new Set(slots.filter((s, j) => j !== i && s.value).map(s => s.value));
  const value = pickWord(pools, slots[i].type, used, rng) ?? slots[i].value;
  return slots.map((s, j) => (j === i ? { ...s, value } : { ...s }));
}

export const setSlotType = (slots, i, type) =>
  slots.map((s, j) => (j === i ? { type, value: null, held: false } : { ...s }));

export function resizeSlots(slots, n, defaultType = 'any') {
  const out = slots.slice(0, n).map(s => ({ ...s }));
  while (out.length < n) out.push({ type: defaultType, value: null, held: false });
  return out;
}
