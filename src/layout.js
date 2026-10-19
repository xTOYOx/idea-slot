// リール窓の横配置（論理座標）。領域 x=33〜W-33、間隔7、全体を中央寄せ。筐体の論理幅 W は 200〜340（高さは 190 固定）
const LEFT = 33, GAP = 7;
export const W_MIN = 200, W_MAX = 340;

// 縦の配置（論理座標）。モニターは窓の上、窓は筐体の絵と重ね物で共通
export const MONITOR_Y = 62, MONITOR_H = 8, REEL_Y = 79, REEL_H = 48;

// リール数の＋－ボタンの台座（筐体の左の外、カーペットの上）。＋は上、－は下
export const COUNT_BTN = { x: 3, size: 14, plusY: 88, minusY: 108 };

// レバーの玉の上端(論理y)。引いていないとき〜一番下まで引いたとき。引いた量 0〜1 を dy(px)/travel(px) から決め、LEVER_PULL 以上で離すと引いた扱い
export const LEVER_REST = 46, LEVER_DOWN = 78, LEVER_PULL = 0.7;
export const leverAmount = (dy, travel) => (travel > 0 ? Math.max(0, Math.min(1, dy / travel)) : 0);

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

// 画面に収まる最大の W（使える領域と丸め方は cabinetWidth と同じ。自動の幅が手動の上限を超えないように）。手動の幅の上限。200 未満にはしない
export function fitWidth(vw, vh, tab) {
  const aw = vw - 2 * tab - 32, ah = vh - 32;
  if (!(aw > 0 && ah > 0)) return W_MIN;
  return Math.max(W_MIN, Math.round(aw * 190 / ah));
}

// 実際に使う W。user が null なら自動（cabinetWidth）、数値なら 200〜fitWidth に収める（340 を超えてよい）。スマホは常に 200
export function effectiveWidth(vw, vh, tab, user) {
  if (vw < 600) return W_MIN;
  if (user === null) return cabinetWidth(vw, vh, tab);
  return Math.min(fitWidth(vw, vh, tab), Math.max(W_MIN, user));
}

// 表示された筐体の幅(px)から論理幅 W を逆算する（ドラッグ用。範囲に収めるのは呼び出し側）
export const widthAt = (px, vh) => Math.round(px / (vh - 32) * 190);
