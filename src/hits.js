// 当たり帳の純粋なロジック（DOM なし）。1件は { combo, memo, savedAt, rating, tags }。
export const MAX_RATING = 5;

export const cleanRating = v => (Number.isInteger(v) && v >= 0 && v <= MAX_RATING ? v : 0);
export const cleanTags = v => (Array.isArray(v) ? [...new Set(v.filter(s => typeof s === 'string').map(s => s.trim()).filter(Boolean))] : []);
export const toggleRating = (cur, n) => (cur === n ? 0 : n); // 同じ数をもう一度押すと 0 に戻る
export const addTags = (tags, raw) => cleanTags([...tags, ...raw.split(/[,、]/)]); // 「、」「,」で区切って足す
export const removeTag = (tags, t) => tags.filter(x => x !== t);
export const tagsOf = list => [...new Set(list.flatMap(f => f.tags))].sort();

export const hasCombo = (list, combo) => list.some(f => f.combo.length === combo.length && f.combo.every((w, i) => w === combo[i]));

export const isActive = ({ text = '', min = 0, tag = '' }) => !!(text.trim() || min || tag);

const newer = (a, b) => b.f.savedAt - a.f.savedAt || a.i - b.i;
const ORDER = {
  new: newer,
  old: (a, b) => a.f.savedAt - b.f.savedAt || b.i - a.i,
  stars: (a, b) => b.f.rating - a.f.rating || newer(a, b),
};

// 絞り込みと並べ替え。{ f, i }（i は元の位置）の配列を返す。並べ替えは savedAt が同じなら元の並び（新しい順）を保つ
export function viewHits(list, { sort = 'new', text = '', min = 0, tag = '' } = {}) {
  const q = text.trim().toLowerCase();
  const hit = f => [...f.combo, f.memo, ...f.tags].some(s => s.toLowerCase().includes(q));
  return list.map((f, i) => ({ f, i }))
    .filter(({ f }) => f.rating >= min && (!tag || f.tags.includes(tag)) && (!q || hit(f)))
    .sort(ORDER[sort] ?? newer);
}

// まとめてコピー用の文字。text: 「A×B×C ★3 #タグ」+ メモ、md: 「- **A × B × C** ★★★☆☆ #タグ」+ 字下げしたメモ
export function formatHits(list, fmt) {
  const md = fmt === 'md';
  return list.map(f => {
    const stars = f.rating ? ' ' + (md ? '★'.repeat(f.rating) + '☆'.repeat(MAX_RATING - f.rating) : '★' + f.rating) : '';
    const head = (md ? `- **${f.combo.join(' × ')}**` : f.combo.join('×')) + stars + f.tags.map(t => ' #' + t).join('');
    const memo = f.memo.trim() ? f.memo.trim().split('\n').map(s => (md ? '  ' : '') + s) : [];
    return [head, ...memo].join('\n');
  }).join('\n');
}
