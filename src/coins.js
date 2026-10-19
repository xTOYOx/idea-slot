// 受け皿のコインの山と、落ちるコインの動き（純粋な計算だけ。描画は cabinet.js）。
// 山 = 列ごとの高さ（コインの枚数）の配列。両隣との差は 1 枚までのなだらかな形を保つ。
export const COL_W = 4, MAX_H = 8, PER_HIT = 4; // 列の幅(論理px)、高さの上限、当たり1件ぶんの初期の枚数
const GRAVITY = 0.18, FRAME_MS = 1000 / 60, DT_MAX = 50; // 重力は 60fps の1フレームあたり。dt が大きいとき（タブ復帰など）は DT_MAX で打ち切る

export const colsFor = width => Math.floor(width / COL_W);

// 列 col に1枚落とす。置くと隣より2枚以上高くなるなら、低い方の隣へ転がす（同じ高さなら rnd で決める）。
// 置けた列を返す。上限に達していれば何もせず -1
export function dropCoin(h, col, rnd = Math.random, max = MAX_H) {
  let c = col;
  for (;;) {
    const l = c > 0 && h[c] > h[c - 1], r = c < h.length - 1 && h[c] > h[c + 1];
    if (!l && !r) break;
    c += l && r ? (h[c - 1] === h[c + 1] ? (rnd() < 0.5 ? -1 : 1) : h[c - 1] < h[c + 1] ? -1 : 1) : l ? -1 : 1;
  }
  if (h[c] >= max) return -1;
  h[c]++;
  return c;
}

// 当たり帳の件数 hits から、起動時の山を作る。中央あたりを中心に落とす
export function initialPile(cols, hits, rnd = Math.random, max = MAX_H) {
  const h = Array(cols).fill(0);
  for (let i = 0; i < hits * PER_HIT; i++) dropCoin(h, Math.max(0, Math.min(cols - 1, Math.floor(cols * (0.5 + (rnd() + rnd() - 1) * 0.3)))), rnd, max);
  return h;
}

// 幅が変わって列の数が変わったとき、山を新しい列数に取り直す（形はなだらかなまま）
export function fitPile(h, cols, max = MAX_H) {
  const r = Array.from({ length: cols }, (_, i) => Math.min(max, h[Math.floor(i * h.length / cols)] ?? 0));
  for (let i = 1; i < cols; i++) r[i] = Math.min(r[i], r[i - 1] + 1);
  for (let i = cols - 2; i >= 0; i--) r[i] = Math.min(r[i], r[i + 1] + 1);
  return r;
}

// 経過ミリ秒 dt を、60fps の1フレームを 1 とする倍率にする（120Hz の画面でも同じ速さ）
export const frameScale = dt => Math.max(0, Math.min(dt, DT_MAX)) / FRAME_MS;

// コイン p を倍率 s ぶん進める（等加速度なので、刻みを細かくしても同じ軌道になる）
export function stepCoin(p, s) {
  p.x += p.vx * s;
  p.y += p.vy * s + 0.5 * GRAVITY * s * s;
  p.vy += GRAVITY * s;
}
