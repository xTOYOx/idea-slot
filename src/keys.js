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
  { id: 'help', label: '使い方', key: 'Slash' },
];
export const DEFAULT_KEYS = Object.fromEntries(ACTIONS.map(a => [a.id, a.key]));

const BLOCKED = new Set(['Escape', 'Tab', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight']);
export const isAssignable = code => typeof code === 'string' && code !== '' && !BLOCKED.has(code);

// 保存データを整える: 知らない操作名・文字列でない値・割り当て不可のキーは捨てて既定で補う。キーが重なっていたら全部既定
export function normalizeKeys(v) {
  const src = v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const keys = Object.fromEntries(ACTIONS.map(a => [a.id, isAssignable(src[a.id]) ? src[a.id] : a.key]));
  return new Set(Object.values(keys)).size === ACTIONS.length ? keys : { ...DEFAULT_KEYS };
}

// 操作 action に code を割り当てる。ほかの操作が使っていたら入れ替える（相手に元のキーを渡す）。割り当て不可なら null
export function assignKey(keys, action, code) {
  if (!isAssignable(code) || !(action in keys)) return null;
  const other = Object.keys(keys).find(id => id !== action && keys[id] === code) ?? null;
  return { keys: { ...keys, [action]: code, ...(other && { [other]: keys[action] }) }, swapped: other };
}

export const actionFor = (keys, code) => Object.keys(keys).find(id => keys[id] === code) ?? null;

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
    ...['more', 'less', 'hist', 'hits', 'help'].map(id => `${keyName(keys[id])}：${label(id)}`),
    'Esc：ポーズ',
  ];
}
