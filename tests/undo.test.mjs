import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUndo, snapOf, sigOf } from '../src/undo.js';

const S = (...vs) => vs.map(value => ({ type: 'any', value, held: false }));

test('snapOf: copies only the persistent fields', () => {
  const s = snapOf([{ type: 'a', base: 'b', savedTheme: 't', value: 'x', held: true, running: true, target: 'y', stoppedAt: 1 }]);
  assert.deepEqual(s, [{ type: 'a', base: 'b', savedTheme: 't', value: 'x', held: true }]);
});
test('sigOf: ignores held, sees type/base/savedTheme/value', () => {
  assert.equal(sigOf([{ type: 'a', value: 'x', held: true }]), sigOf([{ type: 'a', value: 'x', held: false }]));
  for (const d of [{ type: 'b' }, { base: 'c' }, { savedTheme: 't' }, { value: 'y' }]) assert.notEqual(sigOf([{ type: 'a', value: 'x' }]), sigOf([{ type: 'a', value: 'x', ...d }]));
});
test('record: ignores the same result, pushes a new one', () => {
  const u = createUndo();
  assert.equal(u.record(S('a')), true);
  assert.equal(u.record(S('a')), false);
  assert.equal(u.canUndo(), false);
  assert.equal(u.record(S('b')), true);
  assert.equal(u.canUndo(), true);
});
test('undo / redo walk back and forth, null at the ends', () => {
  const u = createUndo();
  assert.equal(u.undo(), null);
  assert.equal(u.redo(), null);
  u.record(S('a')); u.record(S('b')); u.record(S('c'));
  assert.equal(u.undo()[0].value, 'b');
  assert.equal(u.undo()[0].value, 'a');
  assert.equal(u.undo(), null);
  assert.equal(u.canRedo(), true);
  assert.equal(u.redo()[0].value, 'b');
  assert.equal(u.redo()[0].value, 'c');
  assert.equal(u.redo(), null);
  assert.equal(u.canRedo(), false);
});
test('recording the restored snapshot does not push again', () => {
  const u = createUndo();
  u.record(S('a')); u.record(S('b'));
  u.record(u.undo());
  assert.equal(u.canRedo(), true);
  assert.equal(u.redo()[0].value, 'b');
});
test('record after undo drops the redo part', () => {
  const u = createUndo();
  u.record(S('a')); u.record(S('b')); u.record(S('c'));
  u.undo(); u.undo();
  u.record(S('d'));
  assert.equal(u.canRedo(), false);
  assert.equal(u.undo()[0].value, 'a');
});
test('keeps at most max, dropping the oldest', () => {
  const u = createUndo(3);
  for (const v of 'abcde') u.record(S(v));
  assert.equal(u.undo()[0].value, 'd');
  assert.equal(u.undo()[0].value, 'c');
  assert.equal(u.undo(), null);
});
test('returned snapshots are copies; held is restored', () => {
  const u = createUndo();
  u.record([{ type: 'a', value: 'x', held: true }]); u.record(S('y'));
  const s = u.undo();
  assert.equal(s[0].held, true);
  s[0].value = 'zzz';
  u.redo();
  assert.equal(u.undo()[0].value, 'x');
});
test('record copies the input', () => {
  const u = createUndo(), snap = S('a');
  u.record(snap); u.record(S('b'));
  snap[0].value = 'zzz';
  assert.equal(u.undo()[0].value, 'a');
});
