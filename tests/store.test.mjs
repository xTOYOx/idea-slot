import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
const mem = (init = {}) => { const m = { ...init }; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, m }; };

test('defaults when empty', () => {
  const s = createStore(mem());
  assert.equal(s.state.settings.count, 3);
  assert.deepEqual(s.state.history, []);
});
test('corrupt value → default for that key only', () => {
  const s = createStore(mem({ 'slot.history': '{broken', 'slot.excluded': '["犬"]' }));
  assert.deepEqual(s.state.history, []);
  assert.deepEqual(s.state.excluded, ['犬']);
});
test('history capped at 100, newest first, persisted', () => {
  const st = mem(); const s = createStore(st);
  for (let i = 0; i < 105; i++) s.pushHistory([`w${i}`]);
  assert.equal(s.state.history.length, 100);
  assert.deepEqual(s.state.history[0], ['w104']);
  assert.equal(JSON.parse(st.m['slot.history']).length, 100);
});
test('export → import roundtrip', () => {
  const a = createStore(mem()); a.state.excluded.push('猫'); a.save('excluded');
  const b = createStore(mem());
  assert.deepEqual(b.importJSON(a.exportJSON()), { ok: true });
  assert.deepEqual(b.state.excluded, ['猫']);
});
test('foreign or broken import → error, state unchanged', () => {
  const s = createStore(mem()); s.state.excluded.push('猫');
  assert.equal(s.importJSON('{"hello":1}').ok, false);
  assert.equal(s.importJSON('not json').ok, false);
  assert.deepEqual(s.state.excluded, ['猫']);
});
test('throwing storage → still works in memory', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const s = createStore(bad);
  s.pushHistory(['a']);
  assert.deepEqual(s.state.history, [['a']]);
  const n = createStore(null); n.pushHistory(['b']);
  assert.deepEqual(n.state.history, [['b']]);
});
test('default state is fresh per store', () => {
  const a = createStore(mem()); a.state.excluded.push('x'); a.state.settings.slots.pop();
  const b = createStore(mem());
  assert.deepEqual(b.state.excluded, []);
  assert.equal(b.state.settings.slots.length, 3);
});
test('wrong-typed settings → default; saved settings load', () => {
  assert.equal(createStore(mem({ 'slot.settings': '[1]' })).state.settings.count, 3);
  const ok = '{"count":2,"slots":[{"type":"verb"},{"type":"any"}],"animate":false}';
  assert.equal(createStore(mem({ 'slot.settings': ok })).state.settings.count, 2);
});
