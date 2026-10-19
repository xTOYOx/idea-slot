// 種類ごとの語の一覧の組み立て（DOM なし）。元の語 base + 追加した語 custom − 除外した語 excluded。
// 追加した語が元の語にもあれば、ただの元の語として扱う。引数は変えない。

// 今出る語の数（pools の長さと同じ）
export function wordCount(base, custom = [], excluded = []) {
  const all = new Set([...base, ...custom]);
  for (const w of excluded) all.delete(w);
  return all.size;
}

// 一覧の行。並びは 追加 → 元の語 → 除外（薄く）。q は前後の空白を除いた、大小無視の部分一致。
// 返り値 {rows: [{w, kind: 'added' | 'base' | 'off'}] (limit 件まで), total: 絞り込み後の全部の件数, more: rows に入らなかった件数}
export function wordRows({ base, custom = [], excluded = [], q = '', limit = 300 }) {
  const drop = new Set(excluded), inBase = new Set(base), needle = q.trim().toLowerCase();
  const added = [...new Set(custom)].filter(w => !inBase.has(w)), orig = [...inBase];
  const part = (list, kind, keep) => list.filter(w => keep === drop.has(w) && (!needle || w.toLowerCase().includes(needle))).map(w => ({ w, kind }));
  const all = [...part(added, 'added', false), ...part(orig, 'base', false), ...part(orig, 'off', true), ...part(added, 'off', true)];
  return { rows: all.slice(0, limit), total: all.length, more: Math.max(0, all.length - limit) };
}

// 追加する語のうち、元の語にも追加済みにも無いものだけを足した custom と、足した数
export function newCustom(base, custom, words) {
  const have = new Set([...base, ...custom]), fresh = [...new Set(words)].filter(w => !have.has(w));
  return { custom: [...custom, ...fresh], added: fresh.length };
}
