// キー設定（DOM なし）。保存する値は KeyboardEvent.code（'Space' / 'Digit1' / 'KeyH'）。Esc は常にポーズで、割り当てない。
export const ACTIONS = [
  { id: 'lever', label: 'レバー', key: 'Space' },
  { id: 'idea', label: 'IDEA!', key: 'Enter' },
  { id: 'reel1', label: '1番リール', key: 'Digit1' },
  { id: 'reel2', label: '2番リール', key: 'Digit2' },
  { id: 'reel3', label: '3番リール', key: 'Digit3' },
  { id: 'reel4', label: '4番リール', key: 'Digit4' },
  { id: 'reel5', label: '5番リール', key: 'Digit5' },
  { id: 'reel6', label: '6番リール', key: 'Digit6' },
  { id: 'reel7', label: '7番リール', key: 'Digit7' },
  { id: 'more', label: 'リールを増やす', key: 'ArrowUp' },
  { id: 'less', label: 'リールを減らす', key: 'ArrowDown' },
  { id: 'hist', label: '履歴', key: 'KeyH' },
  { id: 'hits', label: '当たり帳', key: 'KeyB' },
  { id: 'tpl', label: 'テンプレート', key: 'KeyT' },
  { id: 'help', label: '使い方', key: 'Slash' },
];
export const DEFAULT_KEYS = Object.fromEntries(ACTIONS.map(a => [a.id, a.key]));

// 「詳細」モードの操作。key は既定のキー（null = 割り当てなし）。group が同じ操作どうしはキーが重なってよい（状態で動くものが決まる）
const NUMS = [1, 2, 3, 4, 5, 6, 7];
export const DETAIL_ACTIONS = [
  { id: 'spin', label: '回す', key: 'Space', group: 'lever' },
  { id: 'stopAll', label: '全部止める', key: null, group: 'lever' },
  ...NUMS.flatMap(n => [
    { id: `stop${n}`, label: `${n}番リールを止める`, key: `Digit${n}`, group: `reel${n}` },
    { id: `lock${n}`, label: `${n}番リールをロック`, key: `Digit${n}`, group: `reel${n}` },
    { id: `unlock${n}`, label: `${n}番リールの解除`, key: `Digit${n}`, group: `reel${n}` },
  ]),
  { id: 'lockAll', label: '全部ロック', key: null, group: 'all' },
  { id: 'unlockAll', label: '全部解除', key: null, group: 'all' },
  ...[['hist', '履歴', 'KeyH'], ['hits', '当たり帳', 'KeyB'], ['tpl', 'テンプレート', 'KeyT']].flatMap(([p, name, key]) => [
    { id: `${p}Open`, label: `${name}を開く`, key, group: p },
    { id: `${p}Close`, label: `${name}を閉じる`, key, group: p },
  ]),
];
export const DEFAULT_DETAIL = Object.fromEntries(DETAIL_ACTIONS.map(a => [a.id, a.key]));
// 標準と詳細で共通の操作（settings.keys の値を使う）
export const SHARED = ['idea', 'more', 'less', 'help'];

const BLOCKED = new Set(['Escape', 'Tab', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight']);
export const isAssignable = code => typeof code === 'string' && code !== '' && !BLOCKED.has(code);

// 保存データを整える: 知らない操作名・文字列でない値・割り当て不可のキーは捨てて既定で補う。同じキーが複数の操作にあってもそのまま（どれも動く）
export function normalizeKeys(v) {
  const src = v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
  return Object.fromEntries(ACTIONS.map(a => [a.id, isAssignable(src[a.id]) ? src[a.id] : a.key]));
}

// 詳細のキー: 知らない操作名は捨て、値は割り当てられるキーか null（なし）。それ以外は既定で補う
export function normalizeDetailKeys(v) {
  const src = v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
  return Object.fromEntries(DETAIL_ACTIONS.map(a => [a.id, src[a.id] === null || isAssignable(src[a.id]) ? src[a.id] : a.key]));
}

// 操作 action に code を割り当てる（ほかの操作と同じキーでもよい）。割り当て不可なら null
export function assignKey(keys, action, code) {
  return isAssignable(code) && action in keys ? { ...keys, [action]: code } : null;
}

// code に割り当てられた操作を全部（押したら全部動かす）
export const actionsFor = (keys, code) => Object.keys(keys).filter(id => keys[id] === code);

// いま効くキーに対応する操作（settings: keyMode / keys / keysDetail）。詳細ではレバー・リール・引き出しが keysDetail、idea・more・less・help は keys のまま
export function activeActions({ keyMode, keys, keysDetail }, code) {
  if (keyMode !== 'detail') return actionsFor(keys, code);
  return code ? [...SHARED.filter(id => keys[id] === code), ...DETAIL_ACTIONS.filter(a => keysDetail[a.id] === code).map(a => a.id)] : [];
}

// 2つ以上の操作に割り当てられているキーの集まり（キー設定で赤くする）。detail（詳細のキー）を渡すと、同じ group の中での重なりは数えない（null も）
export function dupCodes(keys, detail) {
  if (detail) {
    const groups = new Map(); // キー → それを使う group の集まり
    const add = (code, g) => { if (code) groups.set(code, (groups.get(code) ?? new Set()).add(g)); };
    SHARED.forEach(id => add(keys[id], id));
    DETAIL_ACTIONS.forEach(a => add(detail[a.id], a.group));
    return new Set([...groups].filter(([, g]) => g.size > 1).map(([code]) => code));
  }
  const seen = new Set(), dup = new Set();
  for (const code of Object.values(keys)) (seen.has(code) ? dup : seen).add(code);
  return dup;
}

// テンキーの数字と Enter は、段の数字と Enter として扱う（今までと同じ）
export const canonCode = code => code.replace(/^Numpad(\d)$/, 'Digit$1').replace(/^NumpadEnter$/, 'Enter');

const NAMES = { Space: 'スペース', Minus: '-', Equal: '=', Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
export const keyName = code => NAMES[code] ?? code.replace(/^(?:Digit|Key)(?=.$)/, '');

const label = id => ACTIONS.find(a => a.id === id).label;
// 使い方の「キー操作」の行。キー設定から作る（詳細では、割り当ての無い操作は出さない）
export function keyHelp({ keyMode, keys, keysDetail: d }) {
  if (keyMode !== 'detail') {
    const reels = ['reel1', 'reel2', 'reel3', 'reel4', 'reel5', 'reel6', 'reel7'].map(id => keyName(keys[id])).join(' / ');
    return [
      ...['lever', 'idea'].map(id => `${keyName(keys[id])}：${label(id)}`),
      `${reels}：リール1〜7の STOP / LOCK`,
      ...['more', 'less', 'hist', 'hits', 'tpl', 'help'].map(id => `${keyName(keys[id])}：${label(id)}`),
      'Ctrl+Z：ひとつ前の結果に戻す',
      'Ctrl+Y：やり直す',
      'Esc：ポーズ',
    ];
  }
  // 「キー：」の部分が同じ行は1行にまとめる（リールの止める・ロック・解除、引き出しの開く・閉じる）
  const out = new Map(), add = (head, tail) => out.set(head, [...(out.get(head) ?? []), tail]);
  const VERB = { stop: '止める', lock: 'ロック', unlock: '解除' };
  for (const a of DETAIL_ACTIONS) {
    const m = /^(stop|lock|unlock)(\d)$/.exec(a.id);
    if (!m) { if (d[a.id]) add(`${keyName(d[a.id])}：`, a.label); continue; }
    if (m[2] !== '1') continue; // リールの列は、1番のところでまとめて
    const on = NUMS.filter(n => d[m[1] + n]);
    if (on.length) add(`${on.map(n => keyName(d[m[1] + n])).join(' / ')}：${on.length === 7 ? '1〜7' : on.join('・')}番リールを`, VERB[m[1]]);
  }
  SHARED.forEach(id => add(`${keyName(keys[id])}：`, label(id)));
  return [...[...out].map(([head, tails]) => head + tails.join(' / ')), 'Ctrl+Z：ひとつ前の結果に戻す', 'Ctrl+Y：やり直す', 'Esc：ポーズ'];
}
