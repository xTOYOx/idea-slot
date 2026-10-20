import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { DEFAULT_KEYS, DEFAULT_DETAIL } from '../src/keys.js';
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
  assert.deepEqual(s.state.settings, { count: 2, slots: [{ type: 'verb' }, { type: 'any' }], autoStop: false, sound: true, reduceMotion: true, width: 620, cabW: null, keys: DEFAULT_KEYS, keyMode: 'basic', keysDetail: DEFAULT_DETAIL, tourSeen: false, dockTab: 'hist' });
});
test('defaults include stats and new settings', () => {
  const s = createStore(mem());
  assert.deepEqual(s.state.stats, { spins: 0, coins: 0, pile: [] });
  assert.equal(s.state.settings.autoStop, false);
  assert.equal(s.state.settings.sound, true);
  assert.equal(s.state.settings.reduceMotion, false);
});
test('countSpin persists', () => {
  const st = mem(); const s = createStore(st);
  s.countSpin(); s.countSpin();
  assert.deepEqual(JSON.parse(st.m['slot.stats']), { spins: 2, coins: 0, pile: [] });
});
test('export is version 3 and includes stats', () => {
  const s = createStore(mem()); s.countSpin();
  const d = JSON.parse(s.exportJSON());
  assert.equal(d.version, 3);
  assert.deepEqual(d.stats, { spins: 1, coins: 0, pile: [] });
});
test('version 1 export imports (no stats, animate)', () => {
  const v1 = { app: 'idea-slot', version: 1, settings: { count: 3, slots: [{ type: 'any' }, { type: 'any' }, { type: 'any' }], animate: true }, history: [], favorites: [], custom: {}, excluded: ['猫'] };
  const s = createStore(mem());
  assert.deepEqual(s.importJSON(JSON.stringify(v1)), { ok: true });
  assert.deepEqual(s.state.excluded, ['猫']);
  assert.equal(s.state.settings.reduceMotion, false);
  assert.deepEqual(s.state.stats, { spins: 0, coins: 0, pile: [] });
});
test('load drops malformed favorites, keeps valid ones, fills memo/savedAt', () => {
  const favs = [{ combo: ['a', 'b'], memo: 'm', savedAt: 5 }, { memo: 'x' }, { combo: [1] }, null, { combo: ['c'] }];
  const s = createStore(mem({ 'slot.favorites': JSON.stringify(favs) }));
  assert.deepEqual(s.state.favorites, [{ combo: ['a', 'b'], memo: 'm', savedAt: 5, rating: 0 }, { combo: ['c'], memo: '', savedAt: 0, rating: 0 }]);
});
test('favorites: rating is an integer 0..5 (else 0); old saved tags are dropped without failing the load', () => {
  const favs = [
    { combo: ['a'], rating: 4, tags: [' x ', 'y'] },
    { combo: ['b'], rating: 9, tags: 'z' },
    { combo: ['c'], rating: 2.5 },
  ];
  const s = createStore(mem({ 'slot.favorites': JSON.stringify(favs) }));
  assert.deepEqual(s.state.favorites.map(f => [f.rating, 'tags' in f]), [[4, false], [0, false], [0, false]]);
});
test('import: favorites keep rating (old tags are dropped), old files without them get defaults, version stays 3', () => {
  const a = createStore(mem());
  a.state.favorites = [{ combo: ['p', 'q'], memo: '', savedAt: 1, rating: 3 }];
  const json = JSON.parse(a.exportJSON());
  assert.equal(json.version, 3);
  const b = createStore(mem());
  assert.deepEqual(b.importJSON(JSON.stringify(json)), { ok: true });
  assert.deepEqual(b.state.favorites, a.state.favorites);
  json.favorites = [{ combo: ['p', 'q'], memo: '', savedAt: 1, rating: 3, tags: ['t'] }]; // 旧ファイルの tags は捨てるだけで、読み込みは失敗しない
  assert.deepEqual(b.importJSON(JSON.stringify(json)), { ok: true });
  assert.deepEqual(b.state.favorites, a.state.favorites);
  json.favorites = [{ combo: ['p'], memo: 'm', savedAt: 2 }];
  assert.deepEqual(b.importJSON(JSON.stringify(json)), { ok: true });
  assert.deepEqual(b.state.favorites, [{ combo: ['p'], memo: 'm', savedAt: 2, rating: 0 }]);
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
test('themes default to []; load drops bad and duplicate entries', () => {
  assert.deepEqual(createStore(mem()).state.themes, []);
  const raw = [{ name: '海', words: ['魚', 1] }, { name: '', words: [] }, { name: '山', words: ['木'] }, { name: '山', words: ['岩'] }, null, { name: '空' }];
  assert.deepEqual(createStore(mem({ 'slot.themes': JSON.stringify(raw) })).state.themes, [{ name: '山', words: ['木'] }]);
  assert.deepEqual(createStore(mem({ 'slot.themes': '{"name":"x"}' })).state.themes, []);
});
test('themes export → import roundtrip keeps order', () => {
  const a = createStore(mem());
  a.state.themes = [{ name: '海', words: ['魚', '波'] }, { name: '山', words: [] }]; a.save('themes');
  const b = createStore(mem());
  assert.deepEqual(b.importJSON(a.exportJSON()), { ok: true });
  assert.deepEqual(b.state.themes, [{ name: '海', words: ['魚', '波'] }, { name: '山', words: [] }]);
  assert.deepEqual(JSON.parse(a.exportJSON()).themes, b.state.themes);
});
test('old files without themes (version 1/2) import as []', () => {
  const s = createStore(mem()); s.state.themes = [{ name: '海', words: ['魚'] }];
  const v2 = JSON.parse(createStore(mem()).exportJSON()); delete v2.themes; v2.version = 2;
  assert.deepEqual(s.importJSON(JSON.stringify(v2)), { ok: true });
  assert.deepEqual(s.state.themes, []);
});
test('import with malformed or duplicate themes → error, state unchanged', () => {
  const s = createStore(mem()); s.state.themes = [{ name: '海', words: ['魚'] }]; s.state.excluded = ['猫'];
  for (const bad of [{ name: '', words: [] }, { name: 'a', words: [1] }, { name: 'a' }, 'x']) {
    const d = JSON.parse(s.exportJSON()); d.themes = [bad]; d.excluded = ['犬'];
    assert.equal(s.importJSON(JSON.stringify(d)).ok, false);
  }
  const dup = JSON.parse(s.exportJSON()); dup.themes = [{ name: 'a', words: [] }, { name: 'a', words: [] }]; dup.excluded = ['犬'];
  assert.equal(s.importJSON(JSON.stringify(dup)).ok, false);
  const nonArr = JSON.parse(s.exportJSON()); nonArr.themes = {}; nonArr.excluded = ['犬'];
  assert.equal(s.importJSON(JSON.stringify(nonArr)).ok, false);
  assert.deepEqual(s.state.themes, [{ name: '海', words: ['魚'] }]);
  assert.deepEqual(s.state.excluded, ['猫']);
});
test('theme names are trimmed: blank is invalid, "A" and "A " are duplicates; words are trimmed and deduped', () => {
  const raw = [{ name: '  ', words: [] }, { name: ' A ', words: [' x ', 'x', '', '  ', 'y'] }, { name: 'A ', words: ['z'] }, { name: 'B', words: [] }];
  assert.deepEqual(createStore(mem({ 'slot.themes': JSON.stringify(raw) })).state.themes, [{ name: 'A', words: ['x', 'y'] }, { name: 'B', words: [] }]);
  const s = createStore(mem());
  for (const bad of [[{ name: '  ', words: [] }], [{ name: 'A', words: [] }, { name: 'A ', words: [] }]]) {
    const d = JSON.parse(s.exportJSON()); d.themes = bad;
    assert.equal(s.importJSON(JSON.stringify(d)).ok, false);
  }
  const d = JSON.parse(s.exportJSON()); d.themes = [{ name: ' A ', words: [' x ', 'x'] }];
  assert.deepEqual(s.importJSON(JSON.stringify(d)), { ok: true });
  assert.deepEqual(s.state.themes, [{ name: 'A', words: ['x'] }]);
});

test('settings.width defaults to 620 and is clamped to 460..1400', () => {
  assert.equal(createStore(mem()).state.settings.width, 620);
  const load = w => createStore(mem({ 'slot.settings': JSON.stringify({ count: 3, slots: [], width: w }) })).state.settings.width;
  assert.equal(load(900), 900);
  assert.equal(load(5000), 1400);
  assert.equal(load(100), 460);
  assert.equal(load('wide'), 620);
});

test('settings.cabW is null (auto) or an integer >= 200; old data is null', () => {
  assert.equal(createStore(mem()).state.settings.cabW, null);
  const load = c => createStore(mem({ 'slot.settings': JSON.stringify({ count: 3, slots: [], ...(c === undefined ? {} : { cabW: c }) }) })).state.settings.cabW;
  assert.equal(load(undefined), null);
  assert.equal(load(null), null);
  assert.equal(load(280), 280);
  assert.equal(load(280.6), 281);
  assert.equal(load(150), 200);
  assert.equal(load('wide'), null);
  assert.equal(load(Infinity), null);
});
test('settings.tourSeen is a boolean (false unless saved as true) and survives export / import', () => {
  const load = t => createStore(mem({ 'slot.settings': JSON.stringify({ count: 3, slots: [], ...(t === undefined ? {} : { tourSeen: t }) }) })).state.settings.tourSeen;
  assert.equal(createStore(mem()).state.settings.tourSeen, false);
  assert.equal(load(undefined), false);
  assert.equal(load('yes'), false);
  assert.equal(load(true), true);
  const a = createStore(mem());
  a.state.settings.tourSeen = true;
  const b = createStore(mem());
  assert.equal(b.importJSON(a.exportJSON()).ok, true);
  assert.equal(b.state.settings.tourSeen, true);
});
test('settings.dockTab (phone list tab): hist / hits / tpl, anything else falls back to hist; survives export / import', () => {
  const load = t => createStore(mem({ 'slot.settings': JSON.stringify({ count: 3, slots: [], ...(t === undefined ? {} : { dockTab: t }) }) })).state.settings.dockTab;
  assert.equal(createStore(mem()).state.settings.dockTab, 'hist');
  assert.equal(load(undefined), 'hist');
  assert.equal(load('nope'), 'hist');
  assert.equal(load(3), 'hist');
  assert.equal(load('hits'), 'hits');
  assert.equal(load('tpl'), 'tpl');
  const a = createStore(mem());
  a.state.settings.dockTab = 'tpl';
  const b = createStore(mem());
  assert.equal(b.importJSON(a.exportJSON()).ok, true);
  assert.equal(b.state.settings.dockTab, 'tpl');
});
test('cabW travels through export / import', () => {
  const s = createStore(mem());
  s.state.settings.cabW = 300;
  const t = createStore(mem());
  assert.deepEqual(t.importJSON(s.exportJSON()), { ok: true });
  assert.equal(t.state.settings.cabW, 300);
});

test('settings.keys: defaults, kept when valid, bad values fall back; old data gets the defaults', () => {
  assert.deepEqual(createStore(mem()).state.settings.keys, DEFAULT_KEYS);
  const load = keys => createStore(mem({ 'slot.settings': JSON.stringify({ count: 3, slots: [], ...(keys === undefined ? {} : { keys }) }) })).state.settings.keys;
  assert.deepEqual(load(undefined), DEFAULT_KEYS);
  assert.deepEqual(load({ lever: 'KeyZ', ghost: 'KeyQ', idea: 7 }), { ...DEFAULT_KEYS, lever: 'KeyZ' });
  assert.deepEqual(load('x'), DEFAULT_KEYS);
  const a = createStore(mem()); a.state.settings.keys = { ...DEFAULT_KEYS, lever: 'KeyZ' };
  const b = createStore(mem());
  assert.deepEqual(b.importJSON(a.exportJSON()), { ok: true });
  assert.equal(b.state.settings.keys.lever, 'KeyZ');
});
test('settings.keyMode / keysDetail: defaults, kept when valid, bad values fall back', () => {
  const st = createStore(mem()).state.settings;
  assert.deepEqual([st.keyMode, st.keysDetail], ['basic', DEFAULT_DETAIL]);
  const load = extra => createStore(mem({ 'slot.settings': JSON.stringify({ count: 3, slots: [], ...extra }) })).state.settings;
  assert.equal(load({ keyMode: 'detail' }).keyMode, 'detail');
  assert.equal(load({ keyMode: 'x' }).keyMode, 'basic');
  assert.deepEqual(load({ keysDetail: { spin: 'KeyZ', stop1: null, ghost: 'KeyQ', lock1: 7 } }).keysDetail, { ...DEFAULT_DETAIL, spin: 'KeyZ', stop1: null });
  assert.deepEqual(load({ keysDetail: 'x' }).keysDetail, DEFAULT_DETAIL);
});
test('templates default to []; load drops bad and duplicate entries', () => {
  assert.deepEqual(createStore(mem()).state.templates, []);
  const raw = [{ name: ' 動物 ', slots: [{ type: 'noun:animal' }, { type: 'any', x: 1 }] }, { name: '', slots: [{ type: 'a' }, { type: 'b' }] }, { name: '動物', slots: [{ type: 'a' }, { type: 'b' }] },
    { name: '一本', slots: [{ type: 'a' }] }, null, { name: 'x' }];
  assert.deepEqual(createStore(mem({ 'slot.templates': JSON.stringify(raw) })).state.templates, [{ name: '動物', slots: [{ type: 'noun:animal' }, { type: 'any' }] }]);
  assert.deepEqual(createStore(mem({ 'slot.templates': '{"a":1}' })).state.templates, []);
});
test('templates export → import roundtrip; export stays version 3; old files import as []', () => {
  const a = createStore(mem());
  a.state.templates = [{ name: 'A', slots: [{ type: 'verb' }, { type: 'mix:verb|my:海' }] }]; a.save('templates');
  const d = JSON.parse(a.exportJSON());
  assert.equal(d.version, 3);
  assert.deepEqual(d.templates, a.state.templates);
  const b = createStore(mem());
  assert.deepEqual(b.importJSON(a.exportJSON()), { ok: true });
  assert.deepEqual(b.state.templates, a.state.templates);
  delete d.templates;
  assert.deepEqual(b.importJSON(JSON.stringify(d)), { ok: true });
  assert.deepEqual(b.state.templates, []);
});
test('import with malformed or duplicate templates → error, state unchanged', () => {
  const two = [{ type: 'a' }, { type: 'b' }];
  const s = createStore(mem()); s.state.templates = [{ name: 'A', slots: two }]; s.state.excluded = ['猫'];
  for (const bad of [[{ name: '', slots: two }], [{ name: 'a', slots: [{ type: 'a' }] }], [{ name: 'a', slots: [{ type: 1 }, { type: 'b' }] }], [{ name: 'a', slots: two }, { name: 'a ', slots: two }], 'x', {}]) {
    const d = JSON.parse(s.exportJSON()); d.templates = bad; d.excluded = ['犬'];
    assert.equal(s.importJSON(JSON.stringify(d)).ok, false, JSON.stringify(bad));
  }
  assert.deepEqual(s.state.templates, [{ name: 'A', slots: two }]);
  assert.deepEqual(s.state.excluded, ['猫']);
});

test('stats.coins: collected coins add up and persist; old or bad values become 0', () => {
  const st = mem(); const s = createStore(st);
  s.addCoins(3); s.addCoins(2);
  assert.deepEqual(JSON.parse(st.m['slot.stats']), { spins: 0, coins: 5, pile: [] });
  assert.equal(createStore(st).state.stats.coins, 5);
  assert.deepEqual(createStore(mem({ 'slot.stats': JSON.stringify({ spins: 4 }) })).state.stats, { spins: 4, coins: 0, pile: [] });
  assert.deepEqual(createStore(mem({ 'slot.stats': JSON.stringify({ spins: 4, coins: -2 }) })).state.stats, { spins: 4, coins: 0, pile: [] });
  assert.deepEqual(createStore(mem({ 'slot.stats': JSON.stringify({ spins: 4, coins: 1.5 }) })).state.stats, { spins: 4, coins: 0, pile: [] });
});

test('stats.pile: the coins left in the tray are saved as column heights; bad values become an empty tray', () => {
  const st = mem(); const s = createStore(st);
  s.savePile([0, 1, 2, 1, 0]);
  assert.deepEqual(JSON.parse(st.m['slot.stats']).pile, [0, 1, 2, 1, 0]);
  assert.deepEqual(createStore(st).state.stats.pile, [0, 1, 2, 1, 0]);
  for (const bad of ['x', [1, -1], [1, 2.5], [1, 99], { a: 1 }]) {
    assert.deepEqual(createStore(mem({ 'slot.stats': JSON.stringify({ spins: 0, pile: bad }) })).state.stats.pile, [], JSON.stringify(bad));
  }
});
