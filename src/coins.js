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

// なぞって回収: 列 col と両隣（reach）のいちばん上のコインを取る。取ったコインの {col, k}（k は段。0 が一番下）を返す。
// 取ったあとは、隣より2枚以上高い列から低い方へ崩して、なだらかな形に戻す
export function takeCoins(h, col, reach = 1) {
  const got = [];
  for (let c = col - reach; c <= col + reach; c++) if (h[c] > 0) got.push({ col: c, k: --h[c] });
  for (let moved = true; moved;) {
    moved = false;
    for (let i = 0; i + 1 < h.length; i++) {
      if (h[i] - h[i + 1] >= 2) { h[i]--; h[i + 1]++; moved = true; }
      else if (h[i + 1] - h[i] >= 2) { h[i + 1]--; h[i]++; moved = true; }
    }
  }
  return got;
}

// 当たり hits 件ぶんの山を作る（?shot のカード画像用）。中央あたりを中心に落とす
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

// ---- 払い出しで飛び出すコインの物理 ----
// コインは幅 4 の箱で、p.x はその左端。p = {x, y, vx, vy, e(反発), f(回転の位相), out(受け皿の外へ出た)}
// tray = {l, r: 壁の位置, floor: 空の山に着くときの p.y, step: 山の1枚ぶんの高さ, rim: 壁に当たる高さの下限(これより上は縁を越える), bottom: 筐体の下端}
const COIN_W = 4, SETTLE_V = 0.4, FRICTION = 0.7, SPILL_VX = 2.5, SPILL_VY = -3;

// 払い出し口 (x, y) から飛び出すコインを作る。初速はばらつき、主に下向き。4枚に1枚くらいは勢いよく横へ振る
export function launchCoin(rnd, x, y) {
  // 噴水のように上へバっと噴き出す。高さはリールの窓（HTML）の下まで（最大で約 30px）。3割は横へ大きく散る
  const wide = rnd() < 0.3, side = rnd() < 0.5 ? -1 : 1;
  const vx = wide ? side * (2.2 + rnd() * 2.6) : (rnd() * 2 - 1) * 2, vy = -(1.8 + rnd() * 1.5);
  return { x, y, vx, vy, e: 0.3 + rnd() * 0.2, f: rnd() * 6, out: false };
}

// stepCoin のあとに呼ぶ。壁・山・床との当たりを解く。山に静かに着いたら積んで 'settled'、山が満杯なら縁へ飛ばして 'spill'
export function hitCoin(p, pile, tray, rnd = Math.random) {
  if (p.out) return;
  const lo = p.x < tray.l && p.vx < 0, hi = p.x + COIN_W > tray.r && p.vx > 0;
  if (lo || hi) {
    if (p.y + COIN_W > tray.rim) { p.x = lo ? tray.l : tray.r - COIN_W; p.vx = -p.vx * p.e; } // 低いところは壁に当たって跳ね返る
    else if (p.x + COIN_W / 2 < tray.l || p.x + COIN_W / 2 > tray.r) p.out = true; // 縁より上は越えて、外へ出る
  }
  if (p.out) return;
  const col = Math.max(0, Math.min(pile.length - 1, Math.floor((p.x + COIN_W / 2 - tray.l - 2) / COL_W)));
  const top = tray.floor - tray.step * pile[col];
  if (p.y < top || p.vy < 0) return;
  p.y = top;
  if (p.vy >= SETTLE_V) { p.vy = -p.vy * p.e; p.vx *= FRICTION; return; } // まだ勢いがある: 跳ねる
  if (dropCoin(pile, col, rnd) >= 0) return 'settled';
  p.out = true; // 山が満杯: 近い方の縁へ弾いて、こぼす
  p.vx = p.x + COIN_W / 2 < (tray.l + tray.r) / 2 ? -SPILL_VX : SPILL_VX;
  p.vy = SPILL_VY;
  return 'spill';
}

// 筐体の下端を過ぎたか
export const isGone = (p, tray) => p.y > tray.bottom;

// 飛んでいる間の回転（コマ送りの位相）。速いほど速く回る
export function spinCoin(p, s) {
  p.f += (0.2 + 0.25 * Math.hypot(p.vx, p.vy)) * s;
}
