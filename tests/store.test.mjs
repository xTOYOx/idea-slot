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
test('v1 settings with animate migrate to reduceMotion', () => {
  const s = createStore(mem({ 'slot.settings': JSON.stringify({ count: 2, slots: [{ type: 'verb' }, { type: 'any' }], animate: false }) }));
  assert.deepEqual(s.state.settings, { count: 2, slots: [{ type: 'verb' }, { type: 'any' }], autoStop: false, sound: true, reduceMotion: true });
});
test('defaults include stats and new settings', () => {
  const s = createStore(mem());
  assert.deepEqual(s.state.stats, { spins: 0 });
  assert.equal(s.state.settings.autoStop, false);
  assert.equal(s.state.settings.sound, true);
  assert.equal(s.state.settings.reduceMotion, false);
});
test('countSpin persists', () => {
  const st = mem(); const s = createStore(st);
  s.countSpin(); s.countSpin();
  assert.deepEqual(JSON.parse(st.m['slot.stats']), { spins: 2 });
});
test('export is version 2 and includes stats', () => {
  const s = createStore(mem()); s.countSpin();
  const d = JSON.parse(s.exportJSON());
  assert.equal(d.version, 2);
  assert.deepEqual(d.stats, { spins: 1 });
});
test('version 1 export imports (no stats, animate)', () => {
  const v1 = { app: 'idea-slot', version: 1, settings: { count: 3, slots: [{ type: 'any' }, { type: 'any' }, { type: 'any' }], animate: true }, history: [], favorites: [], custom: {}, excluded: ['猫'] };
  const s = createStore(mem());
  assert.deepEqual(s.importJSON(JSON.stringify(v1)), { ok: true });
  assert.deepEqual(s.state.excluded, ['猫']);
  assert.equal(s.state.settings.reduceMotion, false);
  assert.deepEqual(s.state.stats, { spins: 0 });
});
test('load drops malformed favorites, keeps valid ones, fills memo/savedAt', () => {
  const favs = [{ combo: ['a', 'b'], memo: 'm', savedAt: 5 }, { memo: 'x' }, { combo: [1] }, null, { combo: ['c'] }];
  const s = createStore(mem({ 'slot.favorites': JSON.stringify(favs) }));
  assert.deepEqual(s.state.favorites, [{ combo: ['a', 'b'], memo: 'm', savedAt: 5 }, { combo: ['c'], memo: '', savedAt: 0 }]);
});
test('import with malformed favorites → error, state unchanged', () => {
  const s = createStore(mem()); s.state.excluded.push('猫');
  const bad = JSON.parse(s.exportJSON()); bad.favorites = [{ memo: 'x' }]; bad.excluded = ['犬'];
  assert.equal(s.importJSON(JSON.stringify(bad)).ok, false);
  assert.deepEqual(s.state.favorites, []);
  assert.deepEqual(s.state.excluded, ['猫']);
});
test('custom: load drops non-string-array keys; import rejects them', () => {
  const raw = { noun: 'x', verb: ['走る'], tag: [1] };
  assert.deepEqual(createStore(mem({ 'slot.custom': JSON.stringify(raw) })).state.custom, { verb: ['走る'] });
  const s = createStore(mem());
  const bad = JSON.parse(s.exportJSON()); bad.custom = raw;
  assert.equal(s.importJSON(JSON.stringify(bad)).ok, false);
  assert.deepEqual(s.state.custom, {});
});
test('slot theme survives load and export/import', () => {
  const st = mem({ 'slot.settings': JSON.stringify({ count: 1, slots: [{ type: 'any', theme: '宇宙' }], autoStop: false, sound: true, reduceMotion: false }) });
  const s = createStore(st);
  assert.deepEqual(s.state.settings.slots, [{ type: 'any', theme: '宇宙' }]);
  const b = createStore(mem());
  assert.deepEqual(b.importJSON(s.exportJSON()), { ok: true });
  assert.deepEqual(b.state.settings.slots, [{ type: 'any', theme: '宇宙' }]);
});
