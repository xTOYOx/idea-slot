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

// 'any' は先に4グループから等確率で選び、空/使用済みなら他のグループへ
function pickWord(pools, type, used, rng) {
  if (type !== 'any') return pickFrom(pools[type], used, rng);
  const start = Math.floor(rng() * GROUPS.length);
  for (let k = 0; k < GROUPS.length; k++) {
    const w = pickFrom(pools[GROUPS[(start + k) % GROUPS.length]], used, rng);
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
