import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, DEFAULT_KEYS, normalizeKeys, assignKey, isAssignable, keyName, actionsFor, dupCodes, canonCode, keyHelp } from '../src/keys.js';

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
  const lines = keyHelp({ ...DEFAULT_KEYS, lever: 'KeyZ' });
  assert.equal(lines[0], 'Z：レバー');
  assert.equal(lines[1], 'Enter：IDEA!');
  assert.ok(lines.includes('1 / 2 / 3 / 4 / 5 / 6 / 7：リール1〜7の STOP / LOCK'));
  assert.ok(lines.includes('H：履歴'));
  assert.ok(lines.includes('T：テンプレート'));
  assert.equal(lines.at(-1), 'Esc：ポーズ');
});
