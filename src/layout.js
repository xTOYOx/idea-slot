// リール窓の横配置（論理座標）。領域 x=33〜W-33、間隔7、全体を中央寄せ。筐体の論理幅 W は 200〜340（高さは 190 固定）
const LEFT = 33, GAP = 7;
export const W_MIN = 200, W_MAX = 340;

// 縦の配置（論理座標）。モニターは窓の上、窓は筐体の絵と重ね物で共通
export const MONITOR_Y = 62, MONITOR_H = 8, REEL_Y = 79, REEL_H = 48;

// リール数の＋－ボタンの台座（筐体の左の外、カーペットの上）。＋は上、－は下
export const COUNT_BTN = { x: 3, size: 14, plusY: 88, minusY: 108 };

export function reelRects(n, W = W_MIN) {
  const WIDTH = W - 2 * LEFT;
  const w = Math.floor((WIDTH - GAP * (n - 1)) / n);
  const x0 = LEFT + Math.floor((WIDTH - (w * n + GAP * (n - 1))) / 2);
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (w + GAP), w }));
}

// STOPボタン台座: 幅は 28（W が広いほど最大40まで広げる）、窓の中央に揃える
export function stopRect({ x, w }, W = W_MIN) {
  const sw = Math.min(28 + Math.floor((W - W_MIN) / 8), 40, w);
  return { x: x + Math.floor((w - sw) / 2), w: sw };
}

// 画面の縦横比に合わせた論理幅 W。vw×vh は画面、tab は端のタブ1枚の幅(px)。幅 600 未満（スマホ）は 200 固定
// 使える領域は、左右にタブ2枚と余白16px×2、上下に余白16px×2 を引いたもの
export function cabinetWidth(vw, vh, tab) {
  if (vw < 600) return W_MIN;
  const aw = vw - 2 * tab - 32, ah = vh - 32;
  if (!(aw > 0 && ah > 0)) return W_MIN;
  return Math.min(W_MAX, Math.max(W_MIN, Math.round(aw / ah * 190)));
}
