// リール窓の横配置（論理座標）。領域 x=33〜167、間隔7、全体を中央寄せ
const LEFT = 33, WIDTH = 134, GAP = 7;

// 縦の配置（論理座標）。モニターは窓の上、窓は筐体の絵と重ね物で共通
export const MONITOR_Y = 62, MONITOR_H = 8, REEL_Y = 79, REEL_H = 48;

// リール数の＋－ボタンの台座（筐体の左の外、カーペットの上）。＋は上、－は下
export const COUNT_BTN = { x: 3, size: 14, plusY: 88, minusY: 108 };

export function reelRects(n) {
  const w = Math.floor((WIDTH - GAP * (n - 1)) / n);
  const x0 = LEFT + Math.floor((WIDTH - (w * n + GAP * (n - 1))) / 2);
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (w + GAP), w }));
}

// STOPボタン台座: 幅は最大28、窓の中央に揃える
export function stopRect({ x, w }) {
  const sw = Math.min(28, w);
  return { x: x + Math.floor((w - sw) / 2), w: sw };
}
