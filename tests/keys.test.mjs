import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, DEFAULT_KEYS, normalizeKeys, assignKey, isAssignable, keyName, actionsFor, dupCodes, canonCode, keyHelp, DETAIL_ACTIONS, DEFAULT_DETAIL, normalizeDetailKeys, activeActions } from '../src/keys.js';

test('defaults cover every action with unique codes', () => {
  assert.deepEqual(ACTIONS.map(a => a.id), ['lever', 'idea', 'reel1', 'reel2', 'reel3', 'reel4', 'reel5', 'reel6', 'reel7', 'more', 'less', 'hist', 'hits', 'tpl', 'help']);
  assert.deepEqual(Object.keys(DEFAULT_KEYS), ACTIONS.map(a => a.id));
  assert.equal(new Set(Object.values(DEFAULT_KEYS)).size, ACTIONS.length);
  assert.deepEqual([DEFAULT_KEYS.lever, DEFAULT_KEYS.idea, DEFAULT_KEYS.reel1, DEFAULT_KEYS.more, DEFAULT_KEYS.less, DEFAULT_KEYS.hist, DEFAULT_KEYS.hits, DEFAULT_KEYS.tpl, DEFAULT_KEYS.help],
    ['Space', 'Enter', 'Digit1', 'ArrowUp', 'ArrowDown', 'KeyH', 'KeyB', 'KeyT', 'Slash']);
});

test('normalizeKeys: anything unusable becomes the defaults; good values are kept', () => {
  for (const bad of [undefined, null, 'x', 5, [], [1]]) assert.deepEqual(normalizeKeys(bad), DEFAULT_KEYS);
  assert.deepEqual(normalizeKeys({ lever: 'KeyZ' }), { ...DEFAULT_KEYS, lever: 'KeyZ' });
  assert.notEqual(normalizeKeys(undefined), DEFAULT_KEYS); // fresh copy
});
test('normalizeKeys: unknown actions and non-string / blocked / empty values are dropped', () => {
  const r = normalizeKeys({ lever: 5, idea: '', hist: 'Escape', hits: 'Tab', help: 'ShiftLeft', ghost: 'KeyZ', more: 'KeyM' });
  assert.deepEqual(r, { ...DEFAULT_KEYS, more: 'KeyM' });
});
test('normalizeKeys: duplicate codes are kept (no reset to the defaults)', () => {
  assert.deepEqual(normalizeKeys({ lever: 'Digit1' }), { ...DEFAULT_KEYS, lever: 'Digit1' });
  assert.equal(normalizeKeys({ lever: 'KeyZ', idea: 'KeyZ' }).idea, 'KeyZ');
});

test('isAssignable: Escape, Tab and bare modifiers are refused', () => {
  for (const c of ['Escape', 'Tab', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', '', undefined, 3]) assert.equal(isAssignable(c), false, String(c));
  for (const c of ['Space', 'KeyA', 'Digit0', 'Slash', 'ArrowUp']) assert.equal(isAssignable(c), true, c);
});

test('assignKey: a free key just moves', () => {
  assert.deepEqual(assignKey(DEFAULT_KEYS, 'lever', 'KeyZ'), { ...DEFAULT_KEYS, lever: 'KeyZ' });
});
test('assignKey: a key used elsewhere is shared, nothing is swapped', () => {
  assert.deepEqual(assignKey(DEFAULT_KEYS, 'lever', 'Enter'), { ...DEFAULT_KEYS, lever: 'Enter' });
});
test('assignKey: refused keys give null; input is not mutated', () => {
  assert.equal(assignKey(DEFAULT_KEYS, 'lever', 'Escape'), null);
  assert.equal(assignKey(DEFAULT_KEYS, 'ghost', 'KeyZ'), null);
  const before = { ...DEFAULT_KEYS };
  assignKey(DEFAULT_KEYS, 'hist', 'KeyB');
  assert.deepEqual(DEFAULT_KEYS, before);
});

test('dupCodes: the codes used by two or more actions', () => {
  assert.equal(dupCodes(DEFAULT_KEYS).size, 0);
  assert.deepEqual([...dupCodes({ ...DEFAULT_KEYS, lever: 'Enter', hist: 'KeyB' })].sort(), ['Enter', 'KeyB']);
});

test('keyName: readable names', () => {
  const names = { Space: 'スペース', Enter: 'Enter', Digit1: '1', KeyH: 'H', Minus: '-', Equal: '=', Slash: '/', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', F5: 'F5' };
  for (const [code, name] of Object.entries(names)) assert.equal(keyName(code), name, code);
});

test('actionsFor: every action of a code, or an empty list', () => {
  assert.deepEqual(actionsFor(DEFAULT_KEYS, 'Space'), ['lever']);
  assert.deepEqual(actionsFor({ ...DEFAULT_KEYS, lever: 'KeyZ' }, 'KeyZ'), ['lever']);
  assert.deepEqual(actionsFor({ ...DEFAULT_KEYS, lever: 'Enter' }, 'Enter'), ['lever', 'idea']);
  assert.deepEqual(actionsFor(DEFAULT_KEYS, 'KeyQ'), []);
  assert.deepEqual(actionsFor(DEFAULT_KEYS, undefined), []);
});

test('canonCode: the numpad digits and Enter count as the main-row keys', () => {
  assert.equal(canonCode('Numpad3'), 'Digit3');
  assert.equal(canonCode('NumpadEnter'), 'Enter');
  assert.equal(canonCode('KeyH'), 'KeyH');
});

test('keyHelp: built from the keys, Esc stays last', () => {
  const lines = keyHelp({ keyMode: 'basic', keys: { ...DEFAULT_KEYS, lever: 'KeyZ' }, keysDetail: DEFAULT_DETAIL });
  assert.equal(lines[0], 'Z：レバー');
  assert.equal(lines[1], 'Enter：IDEA!');
  assert.ok(lines.includes('1 / 2 / 3 / 4 / 5 / 6 / 7：リール1〜7の STOP / LOCK'));
  assert.ok(lines.includes('H：履歴'));
  assert.ok(lines.includes('T：テンプレート'));
  assert.equal(lines.at(-1), 'Esc：ポーズ');
});

const S = (extra = {}) => ({ keyMode: 'detail', keys: DEFAULT_KEYS, keysDetail: DEFAULT_DETAIL, ...extra });

test('DETAIL_ACTIONS: defaults match the basic keys; stop/lock/unlock of a reel share its key', () => {
  assert.equal(DETAIL_ACTIONS.length, 2 + 21 + 2 + 6);
  assert.deepEqual([DEFAULT_DETAIL.spin, DEFAULT_DETAIL.stopAll, DEFAULT_DETAIL.lockAll, DEFAULT_DETAIL.unlockAll], ['Space', null, null, null]);
  for (let n = 1; n <= 7; n++) for (const p of ['stop', 'lock', 'unlock']) assert.equal(DEFAULT_DETAIL[p + n], `Digit${n}`);
  assert.deepEqual([DEFAULT_DETAIL.histOpen, DEFAULT_DETAIL.histClose, DEFAULT_DETAIL.hitsOpen, DEFAULT_DETAIL.tplClose], ['KeyH', 'KeyH', 'KeyB', 'KeyT']);
});

test('normalizeDetailKeys: unknown ids dropped, bad values default, null kept', () => {
  for (const bad of [undefined, null, 'x', 5, [], [1]]) assert.deepEqual(normalizeDetailKeys(bad), DEFAULT_DETAIL);
  assert.deepEqual(normalizeDetailKeys({ spin: 'KeyZ', stop1: null, lock1: 5, unlock1: '', histOpen: 'Escape', ghost: 'KeyQ' }), { ...DEFAULT_DETAIL, spin: 'KeyZ', stop1: null });
  assert.notEqual(normalizeDetailKeys(undefined), DEFAULT_DETAIL);
});

test('activeActions: basic mode is actionsFor on keys', () => {
  const st = S({ keyMode: 'basic' });
  assert.deepEqual(activeActions(st, 'Space'), ['lever']);
  assert.deepEqual(activeActions(st, 'Digit1'), ['reel1']);
  assert.deepEqual(activeActions(st, 'KeyQ'), []);
});
test('activeActions: detail mode ignores the basic lever / reels / drawers but keeps idea / more / less / help', () => {
  const st = S({ keys: { ...DEFAULT_KEYS, lever: 'KeyZ', reel1: 'KeyX', hist: 'KeyY' } });
  assert.deepEqual(['KeyZ', 'KeyX', 'KeyY'].map(c => activeActions(st, c)), [[], [], []]);
  assert.deepEqual(activeActions(st, 'Space'), ['spin']);
  assert.deepEqual(activeActions(st, 'Digit1'), ['stop1', 'lock1', 'unlock1']);
  assert.deepEqual(activeActions(st, 'KeyH'), ['histOpen', 'histClose']);
  assert.deepEqual(['Enter', 'ArrowUp', 'ArrowDown', 'Slash'].map(c => activeActions(st, c)), [['idea'], ['more'], ['less'], ['help']]);
});
test('activeActions: shared actions follow keys; null / empty / missing codes never match', () => {
  const st = S({ keys: { ...DEFAULT_KEYS, idea: 'KeyI' }, keysDetail: { ...DEFAULT_DETAIL, spin: null, stopAll: 'KeyI' } });
  assert.deepEqual(activeActions(st, 'KeyI'), ['idea', 'stopAll']);
  assert.deepEqual(activeActions(st, 'Enter'), []);
  for (const c of [null, undefined, '']) assert.deepEqual(activeActions(st, c), []);
});

test('dupCodes (detail): same group may share, other groups and shared actions are red, null never counts', () => {
  assert.equal(dupCodes(DEFAULT_KEYS, DEFAULT_DETAIL).size, 0);
  assert.deepEqual([...dupCodes(DEFAULT_KEYS, { ...DEFAULT_DETAIL, spin: 'Digit1' })], ['Digit1']);
  assert.deepEqual([...dupCodes(DEFAULT_KEYS, { ...DEFAULT_DETAIL, lock1: 'Digit2' })], ['Digit2']);
  assert.deepEqual([...dupCodes(DEFAULT_KEYS, { ...DEFAULT_DETAIL, spin: 'Enter' })], ['Enter']);
  assert.equal(dupCodes(DEFAULT_KEYS, { ...DEFAULT_DETAIL, stopAll: 'Space' }).size, 0); // lever グループ内
  assert.equal(dupCodes(DEFAULT_KEYS, { ...DEFAULT_DETAIL, stopAll: null, lockAll: null }).size, 0);
  assert.equal(dupCodes({ ...DEFAULT_KEYS, lever: 'Digit1' }, DEFAULT_DETAIL).size, 0); // 詳細では効かない標準のキーは数えない
  assert.deepEqual([...dupCodes({ ...DEFAULT_KEYS, more: 'Enter' }, DEFAULT_DETAIL)], ['Enter']);
});

test('keyHelp (detail): merged reel line, unassigned omitted, Esc last', () => {
  const lines = keyHelp(S());
  assert.equal(lines[0], 'スペース：回す');
  assert.ok(lines.includes('1 / 2 / 3 / 4 / 5 / 6 / 7：1〜7番リールを止める / ロック / 解除'));
  assert.ok(lines.includes('H：履歴を開く / 履歴を閉じる'));
  assert.ok(lines.includes('Enter：IDEA!'));
  assert.ok(!lines.some(l => l.includes('全部')));
  assert.equal(lines.at(-1), 'Esc：ポーズ');
});
test('keyHelp (detail): split columns and partial assignment', () => {
  const d = { ...DEFAULT_DETAIL, stopAll: 'KeyA', lock1: 'KeyL', unlock1: null, lock2: null, histClose: null };
  const lines = keyHelp(S({ keysDetail: d }));
  assert.ok(lines.includes('A：全部止める'));
  assert.ok(lines.includes('1 / 2 / 3 / 4 / 5 / 6 / 7：1〜7番リールを止める'));
  assert.ok(lines.includes('L / 3 / 4 / 5 / 6 / 7：1・3・4・5・6・7番リールをロック'));
  assert.ok(lines.includes('2 / 3 / 4 / 5 / 6 / 7：2・3・4・5・6・7番リールを解除'));
  assert.ok(lines.includes('H：履歴を開く'));
});
