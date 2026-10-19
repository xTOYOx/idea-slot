import { TYPE_LABELS, TYPE_KEYS, MY, typeGroups } from './types.js';
import { buildPools } from './pools.js';
import { spin, rerollOne, setSlotType, resizeSlots, pickWord } from './pick.js';
import { parseType, toggleType, normalizeType, remapType } from './typekey.js';
import { initPanels } from './panels.js';
import { startSpin, stopReel, pressReel, isSpinning, allStopped, canEdit, canSave, autoStopDelays, restore } from './machine.js';
import { buildIndex, searchWords } from './search.js';
import { indexGraph, themeWords } from './theme.js';
import { createStore } from './store.js';
import { createCabinet } from './cabinet.js';
import { createSound } from './sound.js';
import { createOverlay } from './reels.js';
import { initScreens } from './screens.js';
import { initThemeScreen } from './themescreen.js';
import { effectiveWidth, fitWidth, widthAt, W_MIN } from './layout.js';
import { initGrips } from './grips.js';
import { initTypePanel } from './typepanel.js';
import { initHelp } from './help.js';
import { actionFor, canonCode, keyHelp } from './keys.js';
import { applySlots } from './templates.js';
import { initKeyScreen } from './keyscreen.js';
import { initTemplateScreen } from './tplscreen.js';

// 保存済みの WordNet テーマ（設定の slots[].theme）を読み込むかのスイッチ。false の間は読み込まない（保存データからは消さない）
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
let cabW = 200, widthTimer = 0, widthFrame = 0, liveW = null; // 筐体の論理幅（自動は画面の縦横比、手動は settings.cabW。cabinet.js・reels.js・CSS の --W と揃える）。liveW: ドラッグ中の仮の幅
let tickTimer = null, beat = 0, autoTimers = [], editing = -1;
const neigh = []; // 止まっている枠の上下の語（止まったときに決め、LOCKしても変えない）

const themeOf = r => (r.type.startsWith('theme:') ? r.type.slice(6) : null);
const typeLabel = t => (t.startsWith(MY) ? '★' + t.slice(MY.length) : TYPE_LABELS[t]);
const typeText = type => parseType(type).map(typeLabel).join('＋'); // 掲示板用（完全な名前）
// モニターの札: 1つなら今まで通り（タグ：は省く）、複数なら短くして「＋」でつなぐ。自作テーマを含むと金色
const shortLabel = k => (k.startsWith(MY) ? '★' + k.slice(MY.length) : TYPE_LABELS[k].replace(/^タグ：/, '').replace(/（全部）$/, '').replace(/^ゲーム(?=ジャンル)/, ''));
function monitorOf(r) {
  const th = themeOf(r), keys = parseType(r.type);
  if (th) return { text: '★' + th, gold: true };
  return { text: keys.length === 1 ? (keys[0].startsWith(MY) ? '★' + keys[0].slice(MY.length) : TYPE_LABELS[keys[0]].replace(/^タグ：/, '')) : keys.map(shortLabel).join('＋'), gold: keys.some(k => k.startsWith(MY)) };
}
function rebuildPools() {
  pools = buildPools(data, state.custom, state.excluded);
  const drop = new Set(state.excluded);
  for (const [w, list] of Object.entries(themes)) pools['theme:' + w] = list.filter(x => !drop.has(x));
  for (const t of state.themes) pools[MY + t.name] = t.words.filter(x => !drop.has(x)); // 自作テーマ（custom や any には混ぜない）
  index = null;
}
const say = text => view.say(text);
const rnd = type => pickWord(pools, type, new Set(), Math.random) ?? '';
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
  const m = monitorOf(reels[i]);
  view.setMonitor(i, m.text, m.gold); // 窓の札は短く（リストは完全な名前）
  view.setWords(i, rowsOf(reels[i], i, fresh));
  view.setState(i, { running: !!reels[i].running, held: reels[i].held });
}

// 回転中だけ押せない部品（枠の数・種類・語えらび・枠に戻す）をまとめて切り替える
const applyBusy = () => document.querySelectorAll('[data-edit]').forEach(el => { el.disabled = !canEdit(reels); });

function sync() {
  if (!reels.length) return; // 起動中（リール未作成）はランプを触らない
  cab.update({ spinning: isSpinning(reels), canSave: canSave(reels, state.favorites), ideas: state.stats.spins, hits: state.favorites.length, reduceMotion: reduceMotion() });
  view.setCount(reels.length, canEdit(reels));
  applyBusy();
  document.body.classList.toggle('reduce-motion', reduceMotion());
}

// ポーズメニューのスイッチ（ON/OFF）と件数・説明の表示
function pauseLabels() {
  const st = state.settings, p = $('pause'), manual = st.cabW !== null;
  [['auto', st.autoStop], ['snd', st.sound], ['rm', st.reduceMotion], ['cabw', !manual]].forEach(([k, on]) => p.querySelector(`[data-p="${k}"]`).setAttribute('aria-checked', String(on)));
  $('cabw-d').textContent = manual ? `横幅 ${st.cabW}（左右の端をドラッグで調整）` : '画面に合わせます';
  p.querySelector('[data-p="hits"] em').textContent = `（${state.favorites.length}）`;
  p.querySelector('[data-p="hist"] em').textContent = `（${state.history.length}）`;
}

function pauseAction(k) {
  const st = state.settings;
  if (k === 'auto') st.autoStop = !st.autoStop;
  else if (k === 'snd') st.sound = sound.enabled = !st.sound;
  else if (k === 'rm') st.reduceMotion = !st.reduceMotion;
  else if (k === 'cabw') { if (st.cabW === null) setManualWidth(cabW); else resetWidth(); return; } // OFF: 今の幅で固定、ON: 自動に戻す
  store.save('settings');
  pauseLabels();
  sync();
}

const panels = initPanels({ pauseAction, open() { typePanel.close(); pauseLabels(); } });

function setReels(next) {
  reels = next;
  if (reels.length !== reelCount) {
    reelCount = reels.length;
    cab.setReels(reelCount, cabW);
    view.build(reelCount, cabW);
    if (editing >= reelCount) closePick();
  }
  reels.forEach((_, i) => paint(i, true));
  saveSettings();
  sync();
}

// --- 筐体の幅（自動は画面に合わせる。手動は左右のつまみで決めた値を、画面に収まる範囲で使う） ---
const tabWidth = () => document.querySelector('.dtab').offsetWidth;
const wantedWidth = (user = liveW ?? state.settings.cabW) => effectiveWidth(innerWidth, innerHeight, tabWidth(), user);
function setCabW(w) {
  cabW = w;
  $('wrap').style.setProperty('--W', w); // CSS の筐体の幅（縦横比）と canvas の幅を同じ値にする
}
// 幅 W が変わったら、静的レイヤーと重ね物を作り直す。連続リサイズ（回転中など）では止まるまで待つ
function fitCabinet() {
  widthTimer = 0;
  const w = wantedWidth();
  if (view && w !== cabW) {
    setCabW(w);
    cab.setReels(reelCount, w);
    view.build(reelCount, w);
    reels.forEach((_, i) => paint(i));
    sync();
  }
  refreshGrips(liveW !== null || state.settings.cabW !== null);
}
addEventListener('resize', () => { clearTimeout(widthTimer); widthTimer = setTimeout(fitCabinet, 200); });

// つまみ。ドラッグ中の作り直しは1フレームに1度まで
const refreshGrips = initGrips($('wrap'), {
  size: () => cabW,
  range: () => [W_MIN, fitWidth(innerWidth, innerHeight, tabWidth())],
  toW: px => widthAt(px, innerHeight),
  live(w) {
    liveW = w;
    widthFrame ||= requestAnimationFrame(() => { widthFrame = 0; fitCabinet(); });
  },
  commit(w) { setManualWidth(w); },
  reset: resetWidth,
});
function setManualWidth(w) {
  liveW = null;
  state.settings.cabW = w;
  store.save('settings');
  fitCabinet();
  pauseLabels();
}
function resetWidth() {
  if (state.settings.cabW === null) return;
  setManualWidth(null);
  say('横幅を自動に戻しました');
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
  if (!reduceMotion()) panels.flash('hits');
}

// --- 窓の語をクリック = クリップボードにコピー（調べもの用） ---
async function copyWord(i) {
  const w = reels[i]?.value;
  if (!w || reels[i].running) return;
  try { await navigator.clipboard.writeText(w); } catch {
    const t = document.createElement('textarea'); // クリップボード API が使えない／断られたとき
    t.value = w;
    t.readOnly = true; // iOS のキーボードや拡大を出さない
    t.style.cssText = 'position:fixed;opacity:0;font-size:16px';
    document.body.append(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    if (!ok) { say('コピーできませんでした'); sound.play('deny'); return; }
  }
  if (reels[i]?.running) return; // コピーの間に回し始めたら、掲示板と光を上書きしない
  sound.play('lock');
  say(`「${w}」をコピーしました`);
  if (!reduceMotion()) view.flash(i);
}

// 自作テーマや語が変わった（作成・語の増減・名前変更・削除・除外）。remap = {from, to}（to が null なら削除）で、その種類のリールを付け替える
function themesChanged(remap) {
  rebuildPools();
  const hit = [];
  if (remap) {
    const from = MY + remap.from, to = remap.to === null ? null : MY + remap.to;
    // 複数選択の中の my:旧名 も付け替え／削除する。base も付け替える（WordNet テーマを戻したときに元の種類へ戻るので）
    reels = reels.map((r, i) => {
      const type = remapType(r.type, from, to), base = r.base === undefined ? undefined : remapType(r.base, from, to);
      if (type === r.type && base === r.base) return r;
      if (type !== r.type) hit.push(i);
      return { ...r, type, ...(base !== undefined && { base }) };
    });
    if (to === null) for (const i of hit) if (!reels[i].held) reels = rerollOne(reels, i, pools); // 消えたテーマの語が窓に残らないように
    saveSettings();
  }
  // 語が減った・名前が変わった・振り直した枠を描き直す。語の追加・除外（remap なし）は、どの枠の上下の語にも関わる
  reels.forEach((r, i) => { if (!remap || parseType(r.type).some(k => k.startsWith(MY)) || hit.includes(i)) paint(i, true); });
  sync();
  if (editing >= 0) renderCards();
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

// --- 種類の選択・語えらび ---
function openPick(i) {
  if (!ready || !canEdit(reels) || !reels[i]) return;
  editing = i;
  $('ph').textContent = `♦ ${i + 1}番リールに固定する語をえらぶ ♦`;
  $('q').value = '';
  renderCards();
  $('pick').showModal();
  $('q').focus({ preventScroll: true });
}

function closePick() { if ($('pick').open) $('pick').close(); editing = -1; }
$('pick').addEventListener('close', () => { editing = -1; });
$('pick').querySelector('[data-close]').onclick = closePick;

// モニターから開く種類えらびのパネル。いまの種類にチェック
const curKeys = i => parseType(reels[i].base ?? reels[i].type);
const markTypes = i => typePanel.mark(curKeys(i), typeText(reels[i].base ?? reels[i].type));
const typePanel = initTypePanel({
  toggle(k) { toggleReelType(k, typePanel.index()); },
  pickWord: openPick,
  restore: i => view.focusMon(i),
});
function openTypes(i) {
  typePanel.open(i, typeGroups(state.themes), curKeys(i), typeText(reels[i].base ?? reels[i].type));
}

// 種類を変える。ロック中の枠は種類だけ変える（語とロックは保つ）、ロックなしなら振り直す
function changeType(i, type) {
  reels = reels[i].held ? reels.map((r, j) => (j === i ? { ...r, type, base: undefined, savedTheme: undefined } : r)) : rerollOne(setSlotType(reels, i, type), i, pools);
  say(`${i + 1}番リールを「${typeText(type)}」に変更`);
  saveSettings();
  paint(i, true);
  sync();
}

function toggleReelType(k, i) {
  if (!ready || !canEdit(reels) || !reels[i]) return;
  const cur = reels[i].base ?? reels[i].type, next = toggleType(cur, k);
  if (next !== cur) changeType(i, next); else sound.play('deny'); // 最後の1つは外せない
  markTypes(i);
}

function changeCount(d) {
  const from = reels.length, n = from + d;
  if (!ready || !canEdit(reels) || n < 2 || n > 4) return;
  typePanel.close();
  let next = resizeSlots(reels, n);
  for (let i = from; i < n; i++) next = rerollOne(next, i, pools);
  setReels(next);
  say(`リール ${from} → ${n}`);
}

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
  $('hits').innerHTML = list || '<div id="empty">いいね！と思ったら IDEA! ボタン</div>';
  panels.setCount('hits', state.favorites.length);
  pauseLabels();
  applyBusy();
}

function renderHistory() {
  panels.setCount('hist', state.history.length);
  $('hclear').disabled = !state.history.length;
  pauseLabels();
  $('hist').innerHTML = state.history.map((c, i) =>
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

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (e.detail > 0 && !b.closest('dialog')) b.blur(); // マウス・タップのあとはキー操作を筐体に返す
  const d = b.dataset;
  if (d.back !== undefined || d.r !== undefined) {
    restoreCombo(d.back !== undefined ? state.favorites[Number(d.back)].combo : state.history[Number(d.r)]);
    if (matchMedia('(max-width: 599px)').matches) panels.closeAll(false); // スマホではシートを閉じて筐体を見せる（ポーズには戻らない）
  }
  else if (d.del !== undefined) { state.favorites.splice(Number(d.del), 1); store.save('favorites'); renderHits(); sync(); }
});
$('hclear').addEventListener('click', () => {
  if (!state.history.length || !confirm('履歴を全部消します（当たり帳は消えません）')) return;
  state.history = [];
  store.save('history');
  renderHistory();
});
$('hits').addEventListener('input', e => {
  if (e.target.dataset.h === undefined) return;
  state.favorites[Number(e.target.dataset.h)].memo = e.target.value;
  store.save('favorites');
});

const help = initHelp();
const renderKeyHelp = () => help.setKeys(keyHelp(state.settings.keys)); // 使い方の「キー操作」はキー設定から作る
renderKeyHelp();

// --- テンプレート（リールの本数と各リールの種類） ---
// 使う: 本数と種類をテンプレートにして振り直す（ロックは外れる）。消えた自作テーマ・知らない種類は「全部ランダム」
function useTemplate(t) {
  if (!ready || !canEdit(reels)) return false;
  setReels(spin(applySlots(t.slots, validType).map(s => ({ ...s, value: null, held: false })), pools));
  say(`テンプレート「${t.name}」を使いました`);
  return true;
}

// --- SPIN・キー操作 ---
$('spin').addEventListener('click', e => { if (e.detail > 0) e.currentTarget.blur(); pull(); });

// 入力欄・select・textarea・ダイアログの中では効かない（Esc は開いているダイアログが自分で閉じる）
document.addEventListener('keydown', e => {
  if (!view || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
  const a = document.activeElement;
  if (a?.closest('input, select, textarea, dialog, [contenteditable]')) return;
  if (e.key === 'Escape') { // 開いているものを一番上から1つ閉じる。何も無ければポーズメニュー
    e.preventDefault(); // 開いたばかりのポーズをブラウザの Esc 処理がすぐ閉じないように
    if (!panels.closeTop()) panels.openPause();
    return;
  }
  if (a?.tagName === 'BUTTON' && (e.code === 'Space' || e.key === 'Enter')) return; // ボタン自身の押下に任せる
  const act = actionFor(state.settings.keys, canonCode(e.code || ''));
  if (!act) return;
  e.preventDefault();
  keyActions[act]();
});
// キー設定（settings.keys）の操作 → 動作。Esc（ポーズ）は割り当てず、上の keydown が固定で受ける
const keyActions = {
  lever: pull, idea,
  reel1: () => press(0), reel2: () => press(1), reel3: () => press(2), reel4: () => press(3),
  more: () => changeCount(1), less: () => changeCount(-1),
  hist: () => panels.toggleDrawer('hist'), hits: () => panels.toggleDrawer('hits'),
  help: () => help.open(),
};

// --- 起動 ---
const validType = k => TYPE_KEYS.includes(k) || state.themes.some(m => MY + m.name === k);
function initialReels() {
  const saved = state.settings.slots.map(s => {
    const type = normalizeType(typeof s?.type === 'string' ? s.type : 'any', validType), theme = typeof s?.theme === 'string' && s.theme ? s.theme : null;
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
    word: copyWord,
    mon(i) {
      if (!ready || !canEdit(reels) || !reels[i]) return;
      openTypes(i);
    },
    count: changeCount,
  });
  initThemeScreen({ store, data, isSpinning: () => isSpinning(reels), changed: themesChanged });
  initTemplateScreen({
    store, isSpinning: () => isSpinning(reels),
    current: () => reels.map(r => ({ type: r.base ?? r.type })),
    label: type => typeText(normalizeType(type, validType)), // 使うときと同じ見え方（消えたテーマは外れる）
    use: useTemplate,
    close: () => panels.closeScreen('templates'),
  });
  initKeyScreen({ store, changed: renderKeyHelp });
  initScreens({
    store, isSpinning: () => isSpinning(reels),
    async afterImport() {
      ready = false; // テーマを読み込む間は回さない
      try {
        const ok = await prepareThemes();
        clearInterval(tickTimer); // 回転中だったときの残りを片づける
        autoTimers.forEach(clearTimeout);
        autoTimers = [];
        rebuildPools();
        sound.enabled = state.settings.sound;
        fitCabinet(); // 読み込んだ設定の筐体の幅に合わせる
        pauseLabels();
        renderKeyHelp();
        closePick();
        typePanel.close();
        setReels(initialReels());
        renderHits();
        renderHistory();
        if (!ok) say(THEME_FAIL);
      } finally { ready = true; }
    },
  });
  motionQuery.addEventListener?.('change', sync);
  pauseLabels();
  // 保存したテーマがあれば、筐体を出してからグラフを読む（読めなければテーマなしで続ける）
  reelCount = clamp(state.settings.count);
  setCabW(wantedWidth());
  cab.setReels(reelCount, cabW);
  view.build(reelCount, cabW); // 空の筐体を先に出す（掲示板もここで使えるようになる）
  refreshGrips(state.settings.cabW !== null);
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
    const [words, verbs, genres, tags, games] = await Promise.all(
      ['words', 'verbs', 'genres', 'tags', 'games'].map(n => fetch(`data/${n}.json`).then(r => { if (!r.ok) throw new Error(n); return r.json(); })));
    // テーマ集は無くても続行（全部空のテーマ）
    const extra = await fetch('data/extra.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
    data = { words, verbs, genres, tags, games, extra };
  } catch {
    fail();
    return;
  }
  start().catch(fail);
}
load();
