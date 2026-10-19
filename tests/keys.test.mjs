import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, DEFAULT_KEYS, normalizeKeys, assignKey, isAssignable, keyName, actionFor, canonCode, keyHelp } from '../src/keys.js';

test('defaults cover every action with unique codes', () => {
  assert.deepEqual(ACTIONS.map(a => a.id), ['lever', 'idea', 'reel1', 'reel2', 'reel3', 'reel4', 'more', 'less', 'hist', 'hits', 'tpl', 'help']);
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
test('normalizeKeys: duplicate codes make the whole map fall back to the defaults', () => {
  assert.deepEqual(normalizeKeys({ lever: 'Digit1' }), DEFAULT_KEYS);
});

test('isAssignable: Escape, Tab and bare modifiers are refused', () => {
  for (const c of ['Escape', 'Tab', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', '', undefined, 3]) assert.equal(isAssignable(c), false, String(c));
  for (const c of ['Space', 'KeyA', 'Digit0', 'Slash', 'ArrowUp']) assert.equal(isAssignable(c), true, c);
});

test('assignKey: a free key just moves', () => {
  const r = assignKey(DEFAULT_KEYS, 'lever', 'KeyZ');
  assert.deepEqual(r, { keys: { ...DEFAULT_KEYS, lever: 'KeyZ' }, swapped: null });
});
test('assignKey: a key used elsewhere is swapped, the other action gets the old key', () => {
  const r = assignKey(DEFAULT_KEYS, 'lever', 'Enter');
  assert.deepEqual(r, { keys: { ...DEFAULT_KEYS, lever: 'Enter', idea: 'Space' }, swapped: 'idea' });
});
test('assignKey: same key again changes nothing; refused keys give null; input is not mutated', () => {
  assert.deepEqual(assignKey(DEFAULT_KEYS, 'lever', 'Space'), { keys: DEFAULT_KEYS, swapped: null });
  assert.equal(assignKey(DEFAULT_KEYS, 'lever', 'Escape'), null);
  assert.equal(assignKey(DEFAULT_KEYS, 'ghost', 'KeyZ'), null);
  const before = { ...DEFAULT_KEYS };
  assignKey(DEFAULT_KEYS, 'hist', 'KeyB');
  assert.deepEqual(DEFAULT_KEYS, before);
});

test('keyName: readable names', () => {
  const names = { Space: 'スペース', Enter: 'Enter', Digit1: '1', KeyH: 'H', Minus: '-', Equal: '=', Slash: '/', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', F5: 'F5' };
  for (const [code, name] of Object.entries(names)) assert.equal(keyName(code), name, code);
});

test('actionFor: finds the action of a code, or null', () => {
  assert.equal(actionFor(DEFAULT_KEYS, 'Space'), 'lever');
  assert.equal(actionFor({ ...DEFAULT_KEYS, lever: 'KeyZ' }, 'KeyZ'), 'lever');
  assert.equal(actionFor(DEFAULT_KEYS, 'KeyQ'), null);
  assert.equal(actionFor(DEFAULT_KEYS, undefined), null);
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
  assert.ok(lines.includes('1 / 2 / 3 / 4：リール1〜4の STOP / LOCK'));
  assert.ok(lines.includes('H：履歴'));
  assert.ok(lines.includes('T：テンプレート'));
  assert.equal(lines.at(-1), 'Esc：ポーズ');
});
