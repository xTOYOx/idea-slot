import { TYPE_LABELS, TYPE_KEYS } from './types.js';
import { buildPools } from './pools.js';
import { spin, rerollOne, setSlotType, resizeSlots } from './pick.js';
import { startSpin, stopReel, stopAll, pressReel, isSpinning, allStopped, canEdit, canSave, autoStopDelays, excludeAt, restore } from './machine.js';
import { buildIndex, searchWords } from './search.js';
import { indexGraph, themeWords } from './theme.js';
import { createStore } from './store.js';
import { createCabinet } from './cabinet.js';
import { createSound } from './sound.js';
import { createOverlay } from './reels.js';
import { initScreens } from './screens.js';
import { initThemeScreen } from './themescreen.js';
import { addWords } from './mythemes.js';

// テーマ機能のスイッチ。false の間は語メニューに出さず、保存済みのテーマも使わない（保存データからは消さない）
const THEMES_ON = false;

let ls = null;
try { ls = localStorage; } catch { /* memory only */ }
const store = createStore(ls);
const { state } = store;
const sound = createSound();
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const $ = id => document.getElementById(id);
const app = $('app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = n => (Number.isInteger(n) ? Math.min(4, Math.max(2, n)) : 3);
const reduceMotion = () => state.settings.reduceMotion || motionQuery.matches;

let data = null, pools = null, index = null;
let themes = Object.create(null); // テーマの語 → 集めた語のリスト（除外語を引く前のもの。プールは rebuildPools のたびに除外語を除いて作る）
let ready = false; // 起動の最初の spin が済むまで、回す・IDEA!・リール設定を受け付けない（保存テーマの読み込み待ち）
let graphP = null; // data/graph.json を読む Promise（最初にテーマを使うときだけ。失敗したら捨てて次回やり直す）
let reels = [], reelCount = 0, cab = null, view = null;
let tickTimer = null, beat = 0, autoTimers = [], editing = -1, memoTimer = null;
const neigh = []; // 止まっている枠の上下の語（止まったときに決め、LOCKしても変えない）

const themeOf = r => (r.type.startsWith('theme:') ? r.type.slice(6) : null);
const MY = 'my:'; // 自作テーマの種類キーの頭（my:<名前>）
const myOf = r => (r.type.startsWith(MY) ? r.type.slice(MY.length) : null);
const typeLabel = t => (t.startsWith(MY) ? '★' + t.slice(MY.length) : TYPE_LABELS[t]);
function rebuildPools() {
  pools = buildPools(data, state.custom, state.excluded);
  const drop = new Set(state.excluded);
  for (const [w, list] of Object.entries(themes)) pools['theme:' + w] = list.filter(x => !drop.has(x));
  for (const t of state.themes) pools[MY + t.name] = t.words.filter(x => !drop.has(x)); // 自作テーマ（custom や any には混ぜない）
  index = null;
}
const say = text => view.say(text);
const rnd = type => { const p = pools[type] ?? []; return p.length ? p[Math.floor(Math.random() * p.length)] : ''; };
const loadGraph = () => (graphP ??= fetch('data/graph.json', { signal: AbortSignal.timeout?.(15000) })
  .then(r => { if (!r.ok) throw new Error('graph'); return r.json(); })
  .then(indexGraph) // 15秒で打ち切る（signal は本文の読み込みにも効く）
  .catch(e => { graphP = null; throw e; }));
const THEME_FAIL = 'テーマのデータを読み込めませんでした';
const rowsOf = (r, i, fresh) => {
  if (r.running) return [0, 1, 2, 3].map(() => rnd(r.type));
  if (fresh || !neigh[i]) neigh[i] = [rnd(r.type), rnd(r.type), rnd(r.type)];
  return [neigh[i][0], neigh[i][1], r.value ?? '—', neigh[i][2]];
};
const comboText = values => values.map(v => v ?? '—').join(' × ');

function saveSettings() {
  state.settings.count = reels.length;
  // 保存する種類は元の種類（テーマ中は base）。テーマはグラフが読めず外している間も消さない（savedTheme）
  state.settings.slots = reels.map(r => {
    const theme = themeOf(r) ?? r.savedTheme;
    return theme ? { type: r.base ?? r.type, theme } : { type: r.base ?? r.type };
  });
  store.save('settings');
}

// --- 表示の同期 ---
function paint(i, fresh = false) {
  const th = themeOf(reels[i]) ?? myOf(reels[i]);
  view.setMonitor(i, th ?? TYPE_LABELS[reels[i].type].replace(/^タグ：/, ''), !!th); // 窓の札は短く（設定画面は完全な名前）
  view.setWords(i, rowsOf(reels[i], i, fresh));
  view.setState(i, { running: !!reels[i].running, held: reels[i].held });
}

// 回転中だけ押せない部品（枠の数・種類・語えらび・枠に戻す）をまとめて切り替える
const applyBusy = () => app.querySelectorAll('[data-edit]').forEach(el => { el.disabled = !canEdit(reels); });

function sync() {
  if (!reels.length) return; // 起動中（リール未作成）はランプを触らない
  cab.update({ spinning: isSpinning(reels), canSave: canSave(reels, state.favorites), ideas: state.stats.spins, hits: state.favorites.length, reduceMotion: reduceMotion() });
  applyBusy();
  document.body.classList.toggle('reduce-motion', reduceMotion());
}

function chips() {
  $('mode').innerHTML = state.settings.autoStop ? '自動<br>STOP' : '手動<br>STOP';
  $('snd').innerHTML = state.settings.sound ? '音<br>ON' : '音<br>OFF';
}

function setReels(next) {
  reels = next;
  if (reels.length !== reelCount) {
    reelCount = reels.length;
    cab.setReels(reelCount);
    view.build(reelCount);
    if (editing >= reelCount) closePick();
  }
  reels.forEach((_, i) => paint(i, true));
  saveSettings();
  renderSetup();
  sync();
}

// --- 回す・止める・ロック ---
function finish() {
  clearInterval(tickTimer);
  autoTimers.forEach(clearTimeout);
  autoTimers = [];
  const values = reels.map(r => r.value);
  if (values.every(Boolean)) store.pushHistory(values);
  store.countSpin();
  sound.play('chime');
  cab.dribble();
  say(`♦ ${comboText(values)} ♦ いいね！と思ったら IDEA! ボタン ♦`);
  renderHistory();
}

function commitStops(next) {
  const stopped = next.flatMap((r, i) => (reels[i].running && !r.running ? [i] : []));
  reels = next;
  if (!stopped.length) return;
  sound.play('stop');
  stopped.forEach(i => { paint(i, true); if (!reduceMotion()) view.bounce(i); });
  if (allStopped(reels)) finish();
  sync();
}

function pull() {
  if (!ready) return;
  const r = startSpin(reels, pools);
  if (!r.ok) {
    if (r.reason === 'allLocked') { say('全部LOCK中 ... どれかのLOCKをはずしてね'); sound.play('deny'); }
    return;
  }
  view.hideMenu();
  clearTimeout(memoTimer);
  reels = r.reels;
  cab.pullLever();
  sound.play('lever');
  say('SPINNING ... STOPを押せ！ ...');
  reels.forEach((_, i) => paint(i));
  beat = 0;
  tickTimer = setInterval(() => {
    reels.forEach((r2, i) => { if (r2.running) view.setWords(i, rowsOf(r2, i)); });
    if (beat++ % 2 === 0) sound.play('tick');
  }, 120);
  if (state.settings.autoStop) {
    autoStopDelays(reels).forEach((d, i) => {
      if (d !== null) autoTimers.push(setTimeout(() => { if (reels[i].running) commitStops(stopReel(reels, i, performance.now())); }, d));
    });
  }
  sync();
}

function press(i) {
  const r = reels[i];
  if (!r || (!r.running && !r.value)) return;
  const { reels: next, action } = pressReel(reels, i, performance.now());
  if (action === 'ignored') return;
  if (action === 'stop') { commitStops(next); return; }
  reels = next;
  sound.play(action);
  say(action === 'lock' ? `LOCK！「${r.value}」を固定` : `UNLOCK ...「${r.value}」も回るよ`);
  paint(i);
  sync();
}

// --- IDEA! ---
function idea() {
  if (!ready) return;
  if (cab.celebrating()) return;
  const status = canSave(reels, state.favorites);
  if (status === 'spinning') { sound.play('deny'); return; }
  cab.pressIdea();
  if (status === 'saved') say('この組み合わせは当たり帳に保存ずみ');
  if (status !== 'ok') { sound.play('deny'); return; }
  const combo = reels.map(r => r.value);
  const saved = { combo, memo: '', savedAt: Date.now() };
  state.favorites = [saved, ...state.favorites];
  store.save('favorites');
  cab.celebrate();
  sound.play('jackpot');
  say(`★★★ BIG IDEA!! ★★★ ${combo.join(' × ')} を当たり帳に保存 ★★★`);
  renderHits();
  sync();
  // 演出のあと、まだ他を触っていなければ新しいカードのメモ欄へ（スマホのキーボードで演出を隠さない）
  clearTimeout(memoTimer);
  memoTimer = setTimeout(() => {
    const a = document.activeElement, input = $('hits').querySelector(`input[data-h="${state.favorites.indexOf(saved)}"]`);
    if (input && canEdit(reels) && (!a || a === document.body || a.closest('#ov, #ctl'))) input.focus({ preventScroll: true });
  }, 3300);
}

// --- 窓の語メニュー ---
function wordMenu(action, i) {
  if (!canEdit(reels) || !reels[i]?.value) return;
  const w = reels[i].value;
  if (action === 'x') {
    if (!state.excluded.includes(w)) { state.excluded = [...state.excluded, w]; store.save('excluded'); }
    rebuildPools();
    reels = excludeAt(reels, i, pools);
    say(`「${w}」を除外`);
  } else if (action === 't') {
    setTheme(i);
    return;
  } else if (/^a\d+$/.test(action)) {
    addToMyTheme(Number(action.slice(1)), w);
    return;
  } else if (action === 'u') {
    reels = reels.map((r, j) => (j === i ? { ...r, type: r.base, base: undefined } : r));
    saveSettings();
    say(`${i + 1}番リールのテーマを解除`);
  } else {
    reels = rerollOne(reels, i, pools);
    say(`${i + 1}番リールを振り直し`);
  }
  paint(i, true);
  sync();
}

// 窓の語を自作テーマに足す（リールの状態は変えない）
function addToMyTheme(k, w) {
  const t = state.themes[k];
  if (!t) return;
  const r = addWords(t, [w]);
  if (!r.added) { say(`「${w}」は★${t.name}にすでに入っています`); return; }
  state.themes = state.themes.map((x, j) => (j === k ? r.theme : x));
  store.save('themes');
  store.unexclude([w]);
  themesChanged(undefined, true);
  say(`「${w}」を★${t.name}に追加（${r.theme.words.length}語）`);
}

// 自作テーマが変わった（作成・語の増減・名前変更・削除）。remap = {from, to}（to が null なら削除）で、その種類のリールを付け替える
// quiet: 語メニューからの追加（リールの見た目は触らない）
function themesChanged(remap, quiet = false) {
  rebuildPools();
  const hit = [];
  if (remap) {
    const from = MY + remap.from, to = remap.to === null ? 'any' : MY + remap.to;
    // base も付け替える（WordNet テーマを戻したときに元の種類へ戻るので）
    reels = reels.map((r, i) => {
      if (r.type !== from && r.base !== from) return r;
      if (r.type === from) hit.push(i);
      return { ...r, ...(r.type === from && { type: to }), ...(r.base === from && { base: to }) };
    });
    if (to === 'any') for (const i of hit) if (!reels[i].held) reels = rerollOne(reels, i, pools);
    saveSettings();
  }
  if (!quiet) reels.forEach((r, i) => { if (myOf(r) || hit.includes(i)) paint(i, true); }); // 語が減った・名前が変わった・振り直した枠を描き直す
  sync();
  renderSetup();
  if (editing >= 0) renderCards();
}

// 語をテーマにする。グラフは初回だけ読む。止まっている間だけ（読み込み中に回し始めたら何もしない）
async function setTheme(i) {
  const w = reels[i].value;
  if (!graphP) say('テーマを準備中…');
  let G;
  try { G = await loadGraph(); } catch { say(THEME_FAIL); sound.play('deny'); return; }
  if (!canEdit(reels) || reels[i]?.value !== w) return;
  const raw = themeWords(G, w), drop = new Set(state.excluded);
  if (!raw.some(x => !drop.has(x))) { say(`「${w}」はテーマにできない語です`); sound.play('deny'); return; }
  themes[w] = raw; // 除外前の語を持つ（除外を戻したとき rebuildPools で復活する）
  rebuildPools();
  reels = reels.map((r, j) => (j === i ? { ...r, type: 'theme:' + w, base: r.base ?? r.type, savedTheme: undefined, held: false } : r));
  saveSettings();
  say(`★ ${i + 1}番リールのテーマ：${w}（${pools['theme:' + w].length}語）`);
  paint(i, true);
  sync();
}

// 保存したテーマの語を集める（初回起動・インポート後）。読めなければ false。保存データのテーマは消さない
const savedThemes = () => !THEMES_ON ? [] : [...new Set(state.settings.slots.map(s => s?.theme).filter(w => typeof w === 'string' && w))];
async function prepareThemes() {
  const words = savedThemes(), next = Object.create(null);
  if (!words.length) { themes = next; return true; }
  try {
    const G = await loadGraph();
    for (const w of words) { const list = themeWords(G, w); if (list.length) next[w] = list; }
    themes = next;
    return true;
  } catch { return false; }
}

// --- リール設定・語えらび ---
function renderSetup() {
  if ($('setup').hidden) return;
  const counts = [2, 3, 4].map(n => `<button class="sbtn${n === reels.length ? ' on' : ''}" data-edit data-n="${n}">${n}</button>`).join('');
  const opt = (k, text, t) => `<option value="${esc(k)}"${k === t ? ' selected' : ''}>${esc(text)}</option>`;
  const opts = t => TYPE_KEYS.map(k => opt(k, TYPE_LABELS[k], t)).join('')
    + (state.themes.length ? `<optgroup label="自作テーマ">${state.themes.map(m => opt(MY + m.name, `★${m.name}（${m.words.length}語）`, t)).join('')}</optgroup>` : '');
  const rows = reels.map((r, i) => `<div class="srow"><span>${i + 1}番</span>
    <select data-edit data-t="${i}" aria-label="${i + 1}番リールの種類">${opts(r.base ?? r.type)}</select>
    <button class="sbtn" data-edit data-p="${i}">語をえらぶ</button></div>`).join('');
  $('setup').innerHTML = `<h3>♣ リール設定 ♣</h3><div class="srow"><span>枠の数</span>${counts}</div>${rows}`;
  applyBusy();
}

function closePick() { editing = -1; $('pick').hidden = true; }

function renderCards() {
  const q = $('q').value.trim(), cur = reels[editing]?.value;
  const card = (w, label, cls = '') => `<button class="card ${cls}" data-w="${esc(w)}">${esc(w)}<small>${esc(label)}</small></button>`;
  index ??= buildIndex(pools, TYPE_LABELS, state.themes.flatMap(t => pools[MY + t.name].map(w => ({ w, label: '★' + t.name }))));
  $('cards').innerHTML = (cur ? card(cur, 'いま出ている語', 'g') : '')
    + searchWords(index, q, 50).map(x => card(x.w, x.label)).join('')
    + (q ? card(q, '自由入力で固定', 'p') : '');
}

function fix(w) {
  if (!canEdit(reels)) { sound.play('deny'); return; }
  if (!reels[editing]) return;
  const i = editing;
  reels = reels.map((r, j) => (j === i ? { ...r, value: w, held: true } : r));
  closePick();
  sound.play('lock');
  say(`LOCK！「${w}」を固定`);
  paint(i, true);
  sync();
}

$('setup').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !canEdit(reels)) return;
  if (b.dataset.n) {
    const n = Number(b.dataset.n);
    if (n === reels.length) return;
    let next = resizeSlots(reels, n);
    for (let i = reels.length; i < n; i++) next = rerollOne(next, i, pools);
    setReels(next);
    say(`リールを${n}枠にしました`);
  } else if (b.dataset.p) {
    editing = Number(b.dataset.p);
    $('ph').textContent = `♦ ${editing + 1}番リールに固定する語をえらぶ ♦`;
    $('pick').hidden = false;
    $('q').value = '';
    renderCards();
    $('q').focus({ preventScroll: true });
  }
});
$('setup').addEventListener('change', e => {
  const sel = e.target.closest('select[data-t]');
  if (!sel || !canEdit(reels)) return;
  const i = Number(sel.dataset.t);
  // ロック中の枠は種類だけ変える（語とロックは保つ）
  reels = reels[i].held ? reels.map((r, j) => (j === i ? { ...r, type: sel.value, base: undefined, savedTheme: undefined } : r)) : rerollOne(setSlotType(reels, i, sel.value), i, pools);
  say(`${i + 1}番リールを「${typeLabel(sel.value)}」に変更`);
  saveSettings();
  paint(i, true);
  sync();
});
$('q').addEventListener('input', renderCards);
$('q').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && e.target.value.trim()) fix(e.target.value.trim());
});
$('cards').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) fix(c.dataset.w); });

// --- 当たり帳・履歴 ---
function renderHits() {
  const list = state.favorites.map((f, i) => `<div class="hit${i === 0 ? ' new' : ''}"><b>${f.combo.map(esc).join(' <i>×</i> ')}</b>
    <input data-h="${i}" value="${esc(f.memo)}" placeholder="ひとことメモ（思いついたことを書いておく）" aria-label="メモ">
    <div class="row"><button class="sbtn" data-edit data-back="${i}">枠に戻す</button><button class="sbtn" data-del="${i}">削除</button></div></div>`).join('');
  $('hits').innerHTML = `<h3>♠ 当たり帳 ♠</h3>${list || '<div id="empty">いいね！と思ったら IDEA! ボタン</div>'}`;
  applyBusy();
}

function renderHistory() {
  $('hc').textContent = `（${state.history.length}）`;
  $('history').querySelector('ol').innerHTML = state.history.map((c, i) =>
    `<li><button class="card" data-edit data-r="${i}">${esc(c.join(' × '))}</button></li>`).join('');
  applyBusy();
}

function restoreCombo(combo) {
  if (!canEdit(reels)) return;
  let next = restore(reels, combo.slice(0, 4));
  next = resizeSlots(next, clamp(next.length));
  setReels(next);
  say(`${comboText(next.map(r => r.value))} を枠に戻しました`);
}

app.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (e.detail > 0) b.blur(); // マウス・タップのあとはキー操作を筐体に返す
  const d = b.dataset;
  if (d.back !== undefined) restoreCombo(state.favorites[Number(d.back)].combo);
  else if (d.r !== undefined) restoreCombo(state.history[Number(d.r)]);
  else if (d.del !== undefined) { state.favorites.splice(Number(d.del), 1); store.save('favorites'); renderHits(); sync(); }
});
$('hits').addEventListener('input', e => {
  if (e.target.dataset.h === undefined) return;
  state.favorites[Number(e.target.dataset.h)].memo = e.target.value;
  store.save('favorites');
});

// --- チップ・キー操作 ---
function toggleSetup() {
  $('setup').hidden = !$('setup').hidden;
  if ($('setup').hidden) closePick(); else renderSetup();
}

const chipActions = {
  all() { if (isSpinning(reels)) commitStops(stopAll(reels, performance.now())); },
  mode() { state.settings.autoStop = !state.settings.autoStop; store.save('settings'); chips(); },
  cfg() { if (ready) toggleSetup(); },
  snd() { state.settings.sound = sound.enabled = !state.settings.sound; store.save('settings'); chips(); },
  menuBtn() { if (!isSpinning(reels)) $('menu').hidden = !$('menu').hidden; },
  spin: pull,
};
$('ctl').addEventListener('click', e => { const b = e.target.closest('button'); if (b && view) { if (e.detail > 0) b.blur(); chipActions[b.id]?.(); } });
const closeMenu = () => { $('menu').hidden = true; };
$('menu').addEventListener('click', e => { if (e.target.closest('button')) closeMenu(); });
document.addEventListener('click', e => { if (!e.target.closest('#menu, #menuBtn')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

document.addEventListener('keydown', e => {
  if (!view || e.repeat || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
  const a = document.activeElement;
  if (a && a !== document.body && a.tagName !== 'CANVAS') return;
  if (e.code === 'Space') { e.preventDefault(); pull(); }
  else if (e.key === 'Enter') { e.preventDefault(); idea(); }
  else if (/^[1-4]$/.test(e.key)) press(Number(e.key) - 1);
});

// --- 起動 ---
function initialReels() {
  const saved = state.settings.slots.map(s => {
    const type = TYPE_KEYS.includes(s?.type) || state.themes.some(m => MY + m.name === s?.type) ? s.type : 'any', theme = typeof s?.theme === 'string' && s.theme ? s.theme : null;
    if (!theme) return { type, value: null, held: false };
    return themes[theme] ? { type: 'theme:' + theme, base: type, value: null, held: false } : { type, savedTheme: theme, value: null, held: false };
  });
  return spin(resizeSlots(saved, clamp(state.settings.count)), pools); // 最初の1回（履歴には入れない）
}

async function start() {
  rebuildPools();
  sound.enabled = state.settings.sound;
  cab = createCabinet($('cv'));
  view = createOverlay($('wrap'), $('ov'), {
    reel: press, lever: pull, idea,
    word(i) {
      if (!canEdit(reels) || !reels[i]?.value) return;
      if (view.menuOpen() === i) view.hideMenu(); else view.showMenu(i, { themed: !!themeOf(reels[i]), themes: THEMES_ON, mine: state.themes.map(t => t.name) });
    },
    menu: wordMenu,
  });
  initThemeScreen({ store, isSpinning: () => isSpinning(reels), changed: themesChanged });
  initScreens({
    store, typeLabels: TYPE_LABELS, typeKeys: TYPE_KEYS, isSpinning: () => isSpinning(reels), rebuildPools,
    onSettingsChange() { sync(); },
    async afterImport() {
      ready = false; // テーマを読み込む間は回さない
      try {
        const ok = await prepareThemes();
        clearInterval(tickTimer); // 回転中だったときの残りを片づける
        autoTimers.forEach(clearTimeout);
        autoTimers = [];
        rebuildPools();
        sound.enabled = state.settings.sound;
        chips();
        closePick();
        setReels(initialReels());
        renderHits();
        renderHistory();
        if (!ok) say(THEME_FAIL);
      } finally { ready = true; }
    },
  });
  motionQuery.addEventListener?.('change', sync);
  chips();
  // 保存したテーマがあれば、筐体を出してからグラフを読む（読めなければテーマなしで続ける）
  reelCount = clamp(state.settings.count);
  cab.setReels(reelCount);
  view.build(reelCount); // 空の筐体を先に出す（掲示板もここで使えるようになる）
  if (savedThemes().length) say('テーマを準備中…');
  const themesOk = await prepareThemes();
  rebuildPools();
  setReels(initialReels());
  ready = true;
  renderHits();
  renderHistory();
  say(themesOk ? '★ WELCOME TO IDEA CASINO ★ レバーで回す ★ 気に入った語はLOCK ★ いいね！と思ったら IDEA! ★' : `${THEME_FAIL} ... テーマなしで開始`);
}

function fail() {
  app.innerHTML = '<div class="error"><p>データを読み込めませんでした</p><button class="sbtn" id="reload">再読み込み</button></div>';
  $('reload').onclick = () => location.reload();
}

async function load() {
  try {
    const [words, verbs, genres, tags] = await Promise.all(
      ['words', 'verbs', 'genres', 'tags'].map(n => fetch(`data/${n}.json`).then(r => { if (!r.ok) throw new Error(n); return r.json(); })));
    data = { words, verbs, genres, tags };
  } catch {
    fail();
    return;
  }
  start().catch(fail);
}
load();
