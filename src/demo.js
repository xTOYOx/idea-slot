// 録画用のデモ（?demo、?demo&loop）とカード画像の撮影（?shot）の台本。純粋なデータと計算だけで、動かすのは app.js。
// ?demo は保存データを読み書きせず（メモリだけ）、案内も出さない。

// 窓に出す決まった組み合わせと、リールの種類（モニターの札）。語は種類の中から選ばなくてよい
export const DEMO_WORDS = ['ドラゴン', '料理', 'ローグライク'];
export const DEMO_TYPES = ['extra:monster', 'verb', 'genre'];

export const LEVER_RAMP_MS = 450; // レバーを下まで引く時間（引き終わりで回り始める）
export const SWEEP_MS = 2600; // 受け皿のコインをなぞる時間（右へ、戻って左へ）

// 台本: at（ms）に act を行う。reset: 当たり帳と山を空に（繰り返しのため）、end: 終わり（loop なら頭から）
export const DEMO_SCRIPT = [
  { at: 0, act: 'reset' },
  { at: 1000, act: 'lever' },
  { at: 2800, act: 'stop', reel: 0 },
  { at: 3600, act: 'stop', reel: 1 },
  { at: 4400, act: 'stop', reel: 2 },
  { at: 5600, act: 'idea' },
  { at: 8000, act: 'sweep' },
  { at: 11000, act: 'end' },
];

export function modeOf(search) {
  const p = new URLSearchParams(search), demo = p.has('demo');
  return { demo, loop: demo && p.has('loop'), shot: p.has('shot') };
}

// なぞる指の位置（筐体の論理座標）。p は 0〜1: 受け皿の左から右へ、戻って右から左へ。x の範囲は cabinet.js の受け皿（左端 35、幅は 128 + W - 200）に合わせる
const TRAY_X = 35, TRAY_W = 128, PASS_Y = [173, 168];
export function sweepAt(p, W) {
  const q = Math.min(1, Math.max(0, p)), half = q < 0.5, f = half ? q * 2 : (q - 0.5) * 2;
  const x0 = TRAY_X + 3, x1 = TRAY_X + TRAY_W + (W - 200) - 3;
  return { x: Math.round(half ? x0 + (x1 - x0) * f : x1 - (x1 - x0) * f), y: half ? PASS_Y[0] : PASS_Y[1] };
}
