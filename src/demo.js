// 録画用のデモ（?demo、?demo&loop）とカード画像の撮影（?shot）の台本。純粋なデータと計算だけで、動かすのは app.js。
// ?demo は保存データを読み書きせず（メモリだけ）、案内も出さない。

// 窓に出す決まった組み合わせと、リールの種類（モニターの札）。DEMO_WORDS は最後に当たりにする組み合わせ（?shot でも使う）
export const DEMO_WORDS = ['ドラゴン', '料理', 'ローグライク'];
export const DEMO_TYPES = ['extra:monster', 'verb', 'genre'];

export const LEVER_RAMP_MS = 450; // レバーを下まで引く時間（引き終わりで回り始める）
export const SWEEP_MS = 2600; // 受け皿のコインをなぞる時間（右へ、戻って左へ）
export const TAP_MS = 450; // 指が現れてから、押す（クリックする）まで

// 台本: at（ms）に act を行う。reset: 当たり帳・山・リールを元に戻す（繰り返しのため）、end: 終わり（loop なら頭から）
// lever: 回して、止まる語を words にする（回っているリールだけ。LOCK 中は動かない）、stop: そのリールを止める
// tap: 指が sel の要素を押す。at は「押す時刻」で、指はその TAP_MS 前から動く（startOf）
const T = (at, sel) => ({ at, act: 'tap', sel });
export const DEMO_SCRIPT = [
  { at: 0, act: 'reset' },
  { at: 2400, act: 'lever', words: ['ドラゴン', '眠る', '落ちものパズル'] },
  { at: 4200, act: 'stop', reel: 0 },
  { at: 4800, act: 'stop', reel: 1 },
  { at: 5400, act: 'stop', reel: 2 },
  T(6400, '[data-s="0"]'), // 1番を LOCK
  { at: 7800, act: 'lever', words: DEMO_WORDS },
  { at: 9400, act: 'stop', reel: 1 },
  { at: 10200, act: 'stop', reel: 2 },
  T(12600, '#idea'),
  T(15200, '#d-hits .dtab'), // 当たり帳を開く
  T(17800, '#d-hits [data-dclose]'),
  T(18600, '[data-mon="1"]'), // 2番リールのモニター → 種類えらび
  T(20200, '#types [data-ty="extra:yokai"]'),
  T(21600, '#types [data-close]'),
  { at: 22200, act: 'sweep' },
  { at: 25000, act: 'end' },
];
// 台本の 1 行が動き出す時刻（tap は、押す時刻の TAP_MS 前に指が出る）
export const startOf = s => s.at - (s.act === 'tap' ? TAP_MS : 0);

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
