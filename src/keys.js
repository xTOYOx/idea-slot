// キー設定（DOM なし）。保存する値は KeyboardEvent.code（'Space' / 'Digit1' / 'KeyH'）。Esc は常にポーズで、割り当てない。
export const ACTIONS = [
  { id: 'lever', label: 'レバー', key: 'Space' },
  { id: 'idea', label: 'IDEA!', key: 'Enter' },
  { id: 'reel1', label: '1番リール', key: 'Digit1' },
  { id: 'reel2', label: '2番リール', key: 'Digit2' },
  { id: 'reel3', label: '3番リール', key: 'Digit3' },
  { id: 'reel4', label: '4番リール', key: 'Digit4' },
  { id: 'more', label: 'リールを増やす', key: 'ArrowUp' },
  { id: 'less', label: 'リールを減らす', key: 'ArrowDown' },
  { id: 'hist', label: '履歴', key: 'KeyH' },
  { id: 'hits', label: '当たり帳', key: 'KeyB' },
  { id: 'tpl', label: 'テンプレート', key: 'KeyT' },
  { id: 'help', label: '使い方', key: 'Slash' },
];
export const DEFAULT_KEYS = Object.fromEntries(ACTIONS.map(a => [a.id, a.key]));

const BLOCKED = new Set(['Escape', 'Tab', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight']);
export const isAssignable = code => typeof code === 'string' && code !== '' && !BLOCKED.has(code);

// 保存データを整える: 知らない操作名・文字列でない値・割り当て不可のキーは捨てて既定で補う。同じキーが複数の操作にあってもそのまま（どれも動く）
export function normalizeKeys(v) {
  const src = v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
  return Object.fromEntries(ACTIONS.map(a => [a.id, isAssignable(src[a.id]) ? src[a.id] : a.key]));
}

// 操作 action に code を割り当てる（ほかの操作と同じキーでもよい）。割り当て不可なら null
export function assignKey(keys, action, code) {
  return isAssignable(code) && action in keys ? { ...keys, [action]: code } : null;
}

// code に割り当てられた操作を全部（押したら全部動かす）
export const actionsFor = (keys, code) => Object.keys(keys).filter(id => keys[id] === code);

// 2つ以上の操作に割り当てられているキーの集まり（キー設定で赤くする）
export function dupCodes(keys) {
  const seen = new Set(), dup = new Set();
  for (const code of Object.values(keys)) (seen.has(code) ? dup : seen).add(code);
  return dup;
}

// テンキーの数字と Enter は、段の数字と Enter として扱う（今までと同じ）
export const canonCode = code => code.replace(/^Numpad(\d)$/, 'Digit$1').replace(/^NumpadEnter$/, 'Enter');

const NAMES = { Space: 'スペース', Minus: '-', Equal: '=', Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
export const keyName = code => NAMES[code] ?? code.replace(/^(?:Digit|Key)(?=.$)/, '');

const label = id => ACTIONS.find(a => a.id === id).label;
// 使い方の「キー操作」の行。キー設定から作る
export function keyHelp(keys) {
  const reels = ['reel1', 'reel2', 'reel3', 'reel4'].map(id => keyName(keys[id])).join(' / ');
  return [
    ...['lever', 'idea'].map(id => `${keyName(keys[id])}：${label(id)}`),
    `${reels}：リール1〜4の STOP / LOCK`,
    ...['more', 'less', 'hist', 'hits', 'tpl', 'help'].map(id => `${keyName(keys[id])}：${label(id)}`),
    'Esc：ポーズ',
  ];
}
