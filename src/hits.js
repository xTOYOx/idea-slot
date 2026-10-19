// 当たり帳の純粋なロジック（DOM なし）。1件は { combo, memo, savedAt, rating }。
export const MAX_RATING = 5;

export const cleanRating = v => (Number.isInteger(v) && v >= 0 && v <= MAX_RATING ? v : 0);
export const toggleRating = (cur, n) => (cur === n ? 0 : n); // 同じ数をもう一度押すと 0 に戻る

export const hasCombo = (list, combo) => list.some(f => f.combo.length === combo.length && f.combo.every((w, i) => w === combo[i]));

export const isActive = ({ text = '', min = 0 }) => !!(text.trim() || min);

const newer = (a, b) => b.f.savedAt - a.f.savedAt || a.i - b.i;
const ORDER = {
  new: newer,
  old: (a, b) => a.f.savedAt - b.f.savedAt || b.i - a.i,
  stars: (a, b) => b.f.rating - a.f.rating || newer(a, b),
};

// 絞り込みと並べ替え。{ f, i }（i は元の位置）の配列を返す。並べ替えは savedAt が同じなら元の並び（新しい順）を保つ
export function viewHits(list, { sort = 'new', text = '', min = 0 } = {}) {
  const q = text.trim().toLowerCase();
  const hit = f => [...f.combo, f.memo].some(s => s.toLowerCase().includes(q));
  return list.map((f, i) => ({ f, i }))
    .filter(({ f }) => f.rating >= min && (!q || hit(f)))
    .sort(ORDER[sort] ?? newer);
}
