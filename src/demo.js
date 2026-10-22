// 録画用のデモ（?demo、?demo&loop）とカード画像の撮影（?shot）の台本。純粋なデータと計算だけで、動かすのは app.js。
// ?demo は保存データを読み書きせず（メモリだけ）、案内も出さない。

// 窓に出す決まった組み合わせと、リールの種類（モニターの札）。DEMO_WORDS は最後に当たりにする組み合わせ（?shot でも使う）
export const DEMO_WORDS = ['ドラゴン', '料理', 'ローグライク'];
export const DEMO_TYPES = ['extra:monster', 'verb', 'genre'];

export const LEVER_RAMP_MS = 450; // レバーを下まで引く時間（引き終わりで回り始める）
export const TAP_MS = 450; // 指が現れてから、押す（クリックする）まで

// 台本: at（ms）に act を行う。reset: 当たり帳・山・リールを元に戻す（繰り返しのため）、end: 終わり（loop なら頭から）
// lever: 回して、止まる語を words にする（回っているリールだけ。LOCK 中は動かない）、stop: そのリールを止める
// scene: リールの本数と種類を types の形に一瞬で替える（LOCK・開いた画面・当たりの演出も消す）。つなぎの白い光は撮影側（tools/promo.html）
// tap: 指が sel の要素を押す。at は「押す時刻」で、指はその TAP_MS 前から動く（startOf）
const T = (at, sel) => ({ at, act: 'tap', sel });
// 場面: at で替え、すぐレバー、1 本目は 0.9 秒後、あとは step ずつ左から止める。idea なら、止まって 0.5 秒後に IDEA! を押す
const scene = (at, types, words, step, idea) => [
  { at, act: 'scene', types },
  { at: at + 100, act: 'lever', words },
  ...words.map((_, reel) => ({ at: at + 1000 + reel * step, act: 'stop', reel })),
  ...(idea ? [T(at + 1000 + (words.length - 1) * step + 500, '#idea')] : []),
];
export const DEMO_SCRIPT = [
  { at: 0, act: 'reset' },
  { at: 2200, act: 'lever', words: ['ドラゴン', '眠る', '落ちものパズル'] },
  { at: 3600, act: 'stop', reel: 0 },
  { at: 4100, act: 'stop', reel: 1 },
  { at: 4600, act: 'stop', reel: 2 },
  T(5800, '[data-s="0"]'), // 1番を LOCK
  { at: 7000, act: 'lever', words: DEMO_WORDS },
  { at: 8400, act: 'stop', reel: 1 },
  { at: 9000, act: 'stop', reel: 2 },
  T(11200, '#idea'),
  T(13400, '[data-mon="1"]'), // 2番リールのモニター → 種類えらび
  T(14800, '#types [data-ty="extra:yokai"]'),
  T(16000, '#types [data-close]'),
  // いろいろな構成の見せ場（つなぎ）
  ...scene(16600, ['extra:yokai', 'verb', 'genre', 'extra:jlife'], ['座敷わらし', '配達する', 'カードバトル', '銭湯'], 300),
  ...scene(19400, ['noun:animal', 'extra:sf', 'verb', 'genre', 'extra:stage', 'extra:season', 'extra:rule'], ['猫', '宇宙ステーション', '修理する', 'ローグライク', '深夜のコンビニ', '夏祭り', 'ワンボタン操作'], 250),
  ...scene(22400, ['extra:chara', 'noun:food', 'verb', 'genre', 'extra:season'], ['魔法使い', 'カレー', '育てる', 'タワーディフェンス', '雪の日'], 300, true),
  ...scene(25400, ['extra:monster', 'extra:jlife', 'genre'], ['ゴースト', '引っ越し', 'リズムゲーム'], 300, true),
  { at: 28500, act: 'end' },
];
// 台本の 1 行が動き出す時刻（tap は、押す時刻の TAP_MS 前に指が出る）
export const startOf = s => s.at - (s.act === 'tap' ? TAP_MS : 0);

export function modeOf(search) {
  const p = new URLSearchParams(search), demo = p.has('demo');
  return { demo, loop: demo && p.has('loop'), shot: p.has('shot') };
}
