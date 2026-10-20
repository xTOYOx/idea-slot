import { TYPE_LABELS, TYPE_KEYS, MY, NG, NG_WARN, typeGroups } from './types.js';
import { buildPools } from './pools.js';
import { spin, rerollOne, setSlotType, resizeSlots, pickWord } from './pick.js';
import { parseType, toggleType, toggleGroup, normalizeType, remapType } from './typekey.js';
import { initPanels } from './panels.js';
import { startSpin, stopReel, pressReel, setHeld, canHold, isSpinning, allStopped, canEdit, canSave, autoStopDelays, restore } from './machine.js';
import { hasCombo, isActive, toggleRating, viewHits } from './hits.js';
import { buildIndex, searchWords } from './search.js';
import { indexGraph, themeWords } from './theme.js';
import { createStore } from './store.js';
import { createCabinet } from './cabinet.js';
import { initialPile } from './coins.js';
import { createSound } from './sound.js';
import { createOverlay } from './reels.js';
import { initScreens } from './screens.js';
import { initThemeScreen } from './themescreen.js';
import { effectiveWidth, fitWidth, widthAt, W_MIN, maxReels } from './layout.js';
import { initGrips } from './grips.js';
import { initTypePanel } from './typepanel.js';
import { initHelp } from './help.js';
import { activeActions, canonCode, keyHelp } from './keys.js';
import { applySlots } from './templates.js';
import { initKeyScreen } from './keyscreen.js';
import { initTemplateScreen } from './tplscreen.js';
import { createDefs } from './defs.js';
import { createTip } from './tip.js';
import { createTour } from './tour.js';
import { registerSw } from './pwa.js';
import { createBoot } from './boot.js';
import { initAbout } from './about.js';
import { DEMO_SCRIPT, DEMO_WORDS, DEMO_TYPES, LEVER_RAMP_MS, SWEEP_MS, modeOf, sweepAt } from './demo.js';

// 保存済みの WordNet テーマ（設定の slots[].theme）を読み込むかのスイッチ。false の間は読み込まない（保存データからは消さない）
const THEMES_ON = false;

// ?demo（録画用の自動プレイ）と ?shot（カード画像の撮影）は、保存データを読み書きしない（メモリだけ）
const mode = modeOf(location.search), scripted = mode.demo || mode.shot;
let ls = null;
try { if (!scripted) ls = localStorage; } catch { /* memory only */ }
const store = createStore(ls);
if (scripted) {
  store.state.settings.tourSeen = true; // 案内は出さない
  store.state.settings.slots = DEMO_TYPES.map(type => ({ type }));
}
if (mode.shot) document.body.classList.add('shot'); // 部品を隠す（style.css）。筐体の幅を決める前に付ける
const boot = createBoot(document.getElementById('boot'), 6);
const { state } = store;
const sound = createSound();
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const $ = id => document.getElementById(id);
const app = $('app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const maxN = () => maxReels(innerWidth);
const clamp = n => (Number.isInteger(n) ? Math.min(maxN(), Math.max(2, n)) : 3);
const reduceMotion = () => state.settings.reduceMotion || motionQuery.matches;

let data = null, pools = null, index = null;
let themes = Object.create(null); // テーマの語 → 集めた語のリスト（除外語を引く前のもの。プールは rebuildPools のたびに除外語を除いて作る）
let ready = false; // 起動の最初の spin が済むまで、回す・IDEA!・リール設定を受け付けない（保存テーマの読み込み待ち）
let graphP = null; // data/graph.json を読む Promise（最初にテーマを使うときだけ。失敗したら捨てて次回やり直す）
let reels = [], reelCount = 0, cab = null, view = null;
let cabW = 200, widthTimer = 0, widthFrame = 0, liveW = null; // 筐体の論理幅（自動は画面の縦横比、手動は settings.cabW。cabinet.js・reels.js・CSS の --W と揃える）。liveW: ドラッグ中の仮の幅
let tpl = null; // テンプレの引き出し（tplscreen.js）
let tip = null; // 語の意味の吹き出し（tip.js）
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
  tip?.check(); // 語が変わった・回り始めたら、出ている吹き出しを消す
}

// 回転中だけ押せない部品（枠の数・種類・語えらび・スロットにセット）をまとめて切り替える
const applyBusy = () => document.querySelectorAll('[data-edit]').forEach(el => { el.disabled = !canEdit(reels); });

function sync() {
  if (!reels.length) return; // 起動中（リール未作成）はランプを触らない
  cab.update({ spinning: isSpinning(reels), canSave: canSave(reels, state.favorites), ideas: state.stats.spins, hits: state.favorites.length, coins: state.stats.coins, reduceMotion: reduceMotion() });
  view.setCount(reels.length, canEdit(reels), maxN());
  applyBusy();
  tpl?.refresh(); // テンプレの「今の構成」
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

const panels = initPanels({
  pauseAction, open() { typePanel.close(); pauseLabels(); },
  tab: state.settings.dockTab, onTab(t) { state.settings.dockTab = t; store.save('settings'); }, // スマホ縦の一覧は、最後に開いたタブを覚える
});

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
  // スマホを縦に戻したなど、今の本数が画面の上限を超えたら減らす（回転中は止まってから次のリサイズで）
  if (view && reels.length > maxN() && canEdit(reels)) {
    setReels(resizeSlots(reels, maxN()));
    saveSettings();
    say(`画面が狭いのでリールを${maxN()}本にしました`);
  }
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
  heldFeedback(i, action === 'lock');
}
// ロック／解除の音・ひと言・表示（press と詳細のキーで共通）
function heldFeedback(i, on) {
  sound.play(on ? 'lock' : 'unlock');
  say(on ? `LOCK！「${reels[i].value}」を固定` : `UNLOCK ...「${reels[i].value}」も回るよ`);
  paint(i);
  sync();
}
function holdAll(on) {
  reels = reels.reduce((rs, _, i) => setHeld(rs, i, on), reels);
  sound.play(on ? 'lock' : 'unlock');
  say(on ? '全部LOCK！' : '全部UNLOCK ...');
  reels.forEach((_, i) => paint(i));
  sync();
}

// --- IDEA! ---
const addHit = combo => {
  state.favorites = [{ combo, memo: '', savedAt: Date.now(), rating: 0 }, ...state.favorites];
  store.save('favorites');
};
function idea() {
  if (!ready) return;
  if (cab.celebrating()) return;
  const status = canSave(reels, state.favorites);
  if (status === 'spinning') { sound.play('deny'); return; }
  cab.pressIdea();
  if (status === 'saved') say('この組み合わせは当たり帳に保存ずみ');
  if (status !== 'ok') { sound.play('deny'); return; }
  const combo = reels.map(r => r.value);
  addHit(combo);
  cab.celebrate();
  sound.play('jackpot');
  say(`★★★ BIG IDEA!! ★★★ ${combo.join(' × ')} を当たり帳に保存 ★★★`);
  renderHits();
  sync();
  if (!reduceMotion()) panels.flash('hits');
}

// --- クリップボードにコピー（窓の語・当たり帳）。コピーできたら true ---
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement('textarea'); // クリップボード API が使えない／断られたとき
    t.value = text;
    t.readOnly = true; // iOS のキーボードや拡大を出さない
    t.style.cssText = 'position:fixed;opacity:0;font-size:16px';
    document.body.append(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}
const copyFailed = () => { say('コピーできませんでした'); sound.play('deny'); };

// 窓の語をクリック = コピー（調べもの用）
async function copyWord(i) {
  const w = reels[i]?.value;
  if (!w || reels[i].running) return;
  if (!await copyText(w)) { copyFailed(); return; }
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
  toggleGroup(g) { toggleReelGroup(g, typePanel.index()); },
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
  if (k === NG && !curKeys(i).includes(NG) && !confirm(`${NG_WARN}\n\nこのリールで使いますか？`)) return;
  const cur = reels[i].base ?? reels[i].type, next = toggleType(cur, k, typeGroups(state.themes));
  if (next !== cur) changeType(i, next); else sound.play('deny'); // 全部ランダムだけのときは外せない
  markTypes(i);
}

// 見出しのチェック: その分類をまとめて付ける／外す（NG語は含まれないので確認は不要）
function toggleReelGroup(g, i) {
  if (!ready || !canEdit(reels) || !reels[i]) return;
  const cur = reels[i].base ?? reels[i].type, next = toggleGroup(cur, g);
  if (next !== cur) changeType(i, next); else sound.play('deny');
  markTypes(i);
}

function changeCount(d) {
  const from = reels.length, n = from + d;
  if (!ready || !canEdit(reels) || n < 2 || n > maxN()) return;
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
const hv = { sort: 'new', text: '', min: 0 }; // 一覧の並べ替えと絞り込み（保存しない）
let openFav = null; // スマホ縦で開いている当たり（1つだけ。位置は並べ替え・追加・削除でずれるので、中身そのもので覚える）
const STARS = [1, 2, 3, 4, 5];
// メモの先頭の改行は <textarea> が1つ捨てるので、1つ足しておく
const hitHtml = ({ f, i }) => `<div class="hit${i === 0 ? ' new' : ''}${f === openFav ? ' open' : ''}">
  <div class="stars" role="group" aria-label="評価">${STARS.map(n => `<button class="star${n <= f.rating ? ' on' : ''}" data-star="${i}:${n}" aria-pressed="${n === f.rating}" aria-label="★${n}">★</button>`).join('')}</div>
  <b>${f.combo.map(w => `<span class="w">${esc(w)}</span>`).join(' <i>×</i> ')}</b>
  <button class="sbtn fold" data-fold="${i}" aria-expanded="${f === openFav}" aria-label="メモ・コピー・削除">▾</button>
  <textarea data-h="${i}" rows="1" placeholder="ひとことメモ（思いついたことを書いておく）" aria-label="メモ">
${esc(f.memo)}</textarea>
  <div class="row"><button class="sbtn go" data-edit data-back="${i}">スロットにセット</button><button class="sbtn" data-copy="${i}">コピー</button><button class="sbtn" data-del="${i}">削除</button></div></div>`;

// メモの欄は内容に合わせて高さを伸ばす
const fitMemo = t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 4 + 'px'; };
const fitMemos = () => $('hits').querySelectorAll('textarea').forEach(fitMemo);
addEventListener('resize', fitMemos);
document.fonts?.ready.then(fitMemos);

function renderHits() {
  const all = state.favorites;
  const shown = viewHits(all, hv), active = isActive(hv);
  $('hctl').hidden = !all.length && !active;
  $('hstat').hidden = !active;
  $('hcount').textContent = `絞り込み中：${all.length}件中 ${shown.length}件`;
  $('hits').innerHTML = shown.map(hitHtml).join('') || `<div id="empty">${all.length ? '条件に合う当たりがありません' : 'まだありません'}</div>`;
  fitMemos();
  panels.setCount('hits', all.length);
  pauseLabels();
  applyBusy();
  tip?.check();
}

function renderHistory() {
  panels.setCount('hist', state.history.length);
  $('hclear').disabled = !state.history.length;
  pauseLabels();
  $('hist').innerHTML = state.history.map((c, i) =>
    `<li><button class="card" data-edit data-r="${i}">${esc(c.join(' × '))}</button><button class="sbtn hstar" data-tohit="${i}" aria-label="当たり帳に入れる" title="当たり帳に入れる">★</button></li>`).join('');
  applyBusy();
}

function restoreCombo(combo) {
  if (!canEdit(reels)) return;
  let next = restore(reels, combo.slice(0, maxN()));
  next = resizeSlots(next, clamp(next.length));
  setReels(next);
  say(`${comboText(next.map(r => r.value))} をスロットにセットしました`);
}

// 履歴の ★: その組み合わせを当たり帳に入れる（コインは出さない）
function historyToHit(i) {
  const combo = state.history[i];
  if (!combo) return;
  if (hasCombo(state.favorites, combo)) { say('すでに当たり帳にあります'); sound.play('deny'); return; }
  addHit([...combo]);
  renderHits();
  sync();
  sound.play('lock');
  say(`★ ${combo.join(' × ')} を当たり帳に入れました`);
  if (!reduceMotion()) panels.flash('hits');
}

async function copyHit(i) {
  const f = state.favorites[i];
  if (!f) return;
  if (!await copyText(f.combo.join('×'))) { copyFailed(); return; }
  sound.play('lock');
  say('コピーしました');
}

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (e.detail > 0 && !b.closest('dialog')) b.blur(); // マウス・タップのあとはキー操作を筐体に返す
  const d = b.dataset;
  if (d.back !== undefined || d.r !== undefined) restoreCombo(d.back !== undefined ? state.favorites[Number(d.back)].combo : state.history[Number(d.r)]);
  else if (d.tohit !== undefined) historyToHit(Number(d.tohit));
  else if (d.del !== undefined) { state.favorites.splice(Number(d.del), 1); store.save('favorites'); renderHits(); sync(); }
});
$('hclear').addEventListener('click', () => {
  if (!state.history.length || !confirm('履歴を全部消します（当たり帳は消えません）')) return;
  state.history = [];
  store.save('history');
  renderHistory();
});
$('hits').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.h !== undefined) {
    state.favorites[Number(t.dataset.h)].memo = t.value;
    store.save('favorites');
    fitMemo(t);
  }
});
// スマホ縦: 当たりの行を押すと開き、もう一度押すと閉じる（開くのは1つだけ。PC では見た目は変わらない）
function toggleHit(el, f) {
  const was = f === openFav;
  $('hits').querySelector('.hit.open')?.classList.remove('open');
  $('hits').querySelectorAll('.fold').forEach(b => b.setAttribute('aria-expanded', 'false'));
  openFav = was ? null : f;
  if (!was) {
    el.classList.add('open');
    el.querySelector('.fold').setAttribute('aria-expanded', 'true');
    fitMemo(el.querySelector('textarea')); // 隠れていた間は高さが測れない
  }
}
$('hits').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) {
    const hit = e.target.closest('.hit');
    if (hit && !e.target.closest('textarea')) toggleHit(hit, state.favorites[Number(hit.querySelector('.fold').dataset.fold)]);
    return;
  }
  const d = b.dataset, kb = e.detail === 0; // キーボードで押したときは、描き直したあとにフォーカスを戻す
  if (d.fold !== undefined) toggleHit(b.closest('.hit'), state.favorites[Number(d.fold)]);
  else if (d.star !== undefined) {
    const [i, n] = d.star.split(':').map(Number), f = state.favorites[i];
    f.rating = toggleRating(f.rating, n);
    store.save('favorites');
    renderHits();
    if (kb) $('hits').querySelector(`[data-star="${d.star}"]`)?.focus();
  } else if (d.copy !== undefined) copyHit(Number(d.copy));
});

// 一覧の操作（並べ替え・絞り込み）
for (const [id, key, f] of [['hsort', 'sort', String], ['hmin', 'min', Number], ['hq', 'text', String]]) {
  $(id).addEventListener(id === 'hq' ? 'input' : 'change', e => { hv[key] = f(e.target.value); renderHits(); });
}
$('hfold').addEventListener('click', e => {
  const on = $('hctl').classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', String(on));
  e.currentTarget.textContent = `並べ替え・絞り込み ${on ? '▴' : '▾'}`;
});
$('hreset').addEventListener('click', () => {
  Object.assign(hv, { text: '', min: 0 });
  $('hq').value = '';
  $('hmin').value = '0';
  renderHits();
});

const help = initHelp();
// 初めての案内（settings.tourSeen）。使い方の「案内をもう一度見る」でも開く
const tour = createTour(() => { if (!state.settings.tourSeen) { state.settings.tourSeen = true; store.save('settings'); } });
$('tour-again').addEventListener('click', () => { $('help').close(); tour.start(); });
const renderKeyHelp = () => help.setKeys(keyHelp(state.settings)); // 使い方の「キー操作」はキー設定から作る
renderKeyHelp();

// --- テンプレート（リールの本数と各リールの種類） ---
// 使う: 本数と種類をテンプレートにして振り直す（ロックは外れる）。消えた自作テーマ・知らない種類は「全部ランダム」
function useTemplate(t) {
  if (!ready || !canEdit(reels)) return false;
  setReels(spin(applySlots(t.slots, validType).map(s => ({ ...s, value: null, held: false })), pools)); // 引き出しも一覧も開いたまま（リールが切り替わるのを見せる）
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
  if (a?.tagName === 'BUTTON' && e.key === 'Enter') return; // ボタン自身の押下に任せる
  const acts = activeActions(state.settings, canonCode(e.code || ''));
  if (!acts.length) return; // 割り当ての無いキー（Space も）は、フォーカスのあるボタンをそのまま押す
  e.preventDefault(); // Space などに割り当てがあれば、フォーカスのあるボタンを押さずにその操作だけ
  if (a && a !== document.body) a.blur(); // ダイアログを閉じて戻ったモニターなどに、フォーカスの枠・光りを残さない
  acts.filter(act => keyReady[act]?.() ?? true).forEach(act => keyActions[act]()); // 同じキーを複数の操作に割り当てていたら、全部動かす（詳細は、押した時点の状態で動くものを先に決めてから）
});
// ブラウザによっては Space を離したときにボタンを押すので、keyup でも止める（割り当てがあるときだけ）
document.addEventListener('keyup', e => {
  if (e.code !== 'Space' || document.querySelector('dialog[open]') || document.activeElement?.tagName !== 'BUTTON') return;
  if (activeActions(state.settings, 'Space').length) e.preventDefault();
});
// キー設定（settings.keys）の操作 → 動作。Esc（ポーズ）は割り当てず、上の keydown が固定で受ける
const keyActions = {
  lever: pull, idea,
  reel1: () => press(0), reel2: () => press(1), reel3: () => press(2), reel4: () => press(3), reel5: () => press(4), reel6: () => press(5), reel7: () => press(6),
  more: () => changeCount(1), less: () => changeCount(-1),
  hist: () => panels.toggleDrawer('hist'), tpl: () => panels.toggleDrawer('tpl'), hits: () => panels.toggleDrawer('hits'),
  help: () => help.open(),
  spin: pull, stopAll: () => commitStops(reels.reduce((rs, _, i) => stopReel(rs, i, performance.now()), reels)),
  lockAll: () => holdAll(true), unlockAll: () => holdAll(false),
};
// 詳細のキーが今の状態で動くか（同じキーに止める・ロック・解除があっても、押した時点の状態で動くものだけ動く）。無いものは常に動く
const keyReady = {
  spin: () => allStopped(reels), stopAll: () => isSpinning(reels),
  lockAll: () => allStopped(reels) && reels.some((_, i) => canHold(reels, i, true)),
  unlockAll: () => allStopped(reels) && reels.some((_, i) => canHold(reels, i, false)),
};
for (let i = 0; i < 7; i++) {
  const n = i + 1, hold = on => () => { reels = setHeld(reels, i, on); heldFeedback(i, on); };
  Object.assign(keyActions, { ['stop' + n]: () => commitStops(stopReel(reels, i, performance.now())), ['lock' + n]: hold(true), ['unlock' + n]: hold(false) });
  Object.assign(keyReady, { ['stop' + n]: () => !!reels[i]?.running, ['lock' + n]: () => canHold(reels, i, true, performance.now()), ['unlock' + n]: () => canHold(reels, i, false, performance.now()) });
}
for (const p of ['hist', 'hits', 'tpl']) {
  Object.assign(keyActions, { [p + 'Open']: () => panels.toggleDrawer(p), [p + 'Close']: () => panels.toggleDrawer(p) });
  Object.assign(keyReady, { [p + 'Open']: () => !panels.isOpen(p), [p + 'Close']: () => panels.isOpen(p) });
}

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
  // 受け皿の山は保存しておき、次に開いたときもそのまま（変わるたびに少し待ってまとめて保存、閉じるときは即保存）
  let pileTimer = 0;
  const savePile = () => { clearTimeout(pileTimer); store.savePile(cab.getPile()); };
  cab = createCabinet($('cv'), {
    onCollect: n => { store.addCoins(n); cab.update({ coins: state.stats.coins }); sound.play('coin'); },
    onPile: () => { clearTimeout(pileTimer); pileTimer = setTimeout(savePile, 500); },
  });
  cab.setPile(state.stats.pile);
  addEventListener('pagehide', savePile);
  document.addEventListener('visibilitychange', () => { if (document.hidden) savePile(); });
  view = createOverlay($('wrap'), $('ov'), {
    reel: press, lever: pull, leverPos: a => cab.setLever(a), idea,
    word: copyWord,
    mon(i) {
      if (!ready || !canEdit(reels) || !reels[i]) return;
      openTypes(i);
    },
    count: changeCount,
  });
  // 語の意味: 窓の中央の語と当たり帳の語。PC はマウスを乗せる、スマホは長押し。使う語のファイルだけを読む
  const defs = createDefs(n => fetch(`data/defs/${n}.json`).then(r => { if (!r.ok) throw new Error(n); return r.json(); }), data.games);
  tip = createTip(w => defs.lookup(w), el => {
    if (!el.classList.contains('m')) return el.textContent; // 当たり帳の語
    const r = reels[+el.dataset.w];
    return r && !r.running ? r.value : null; // 回転中は出さない
  });
  tip.attach($('ov'), '.m');
  tip.attach($('hits'), '.w');
  initThemeScreen({ store, data, isSpinning: () => isSpinning(reels), changed: themesChanged });
  tpl = initTemplateScreen({
    store, isSpinning: () => isSpinning(reels),
    current: () => reels.map(r => ({ type: r.base ?? r.type })),
    label: type => typeText(normalizeType(type, validType)), // 使うときと同じ見え方（消えたテーマは外れる）
    use: useTemplate,
    count: n => { panels.setCount('tpl', n); pauseLabels(); },
  });
  initKeyScreen({ store, changed: renderKeyHelp });
  initAbout();
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
        cab.setPile(state.stats.pile); // 受け皿の山も読み込んだものに
        pauseLabels();
        renderKeyHelp();
        closePick();
        typePanel.close();
        setReels(initialReels());
        renderHits();
        renderHistory();
        tpl.render();
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
  tpl.render();
  boot.hide(reduceMotion());
  if (!state.settings.tourSeen) tour.start();
  registerSw();
  say(themesOk ? '★ WELCOME TO IDEA CASINO ★ レバーで回す ★ 気に入った語はLOCK ★ いいね！と思ったら IDEA! ★' : `${THEME_FAIL} ... テーマなしで開始`);
  if (mode.shot) shoot();
  else if (mode.demo) playDemo();
}

// --- ?shot: カード画像（tools/og.mjs）用に、決まった語で止めて当たりの演出を出す。UI の部品は隠す（CSS の body.shot） ---
function shoot() {
  reels = reels.map((r, i) => ({ ...r, value: DEMO_WORDS[i], held: false }));
  reels.forEach((_, i) => paint(i, true));
  state.favorites = [{ combo: [...DEMO_WORDS], memo: '', savedAt: 0, rating: 0 }];
  cab.setPile(initialPile(cab.getPile().length, 8)); // 受け皿にはコインの山
  sync();
  cab.celebrate();
  say(`★★★ BIG IDEA!! ★★★ ${DEMO_WORDS.join(' × ')} ★★★`);
}

// --- ?demo: 台本（demo.js）どおりに1回演じる。?demo&loop は繰り返す ---
const demoActs = {
  reset() {
    state.favorites = [];
    cab.setPile([]);
    renderHits();
    sync();
  },
  // レバーを下まで引いて（引く動きが見える）、離すと回り始める。止まる語は決まった組み合わせにする
  lever() {
    const t0 = performance.now();
    const id = setInterval(() => {
      const a = Math.min(1, (performance.now() - t0) / LEVER_RAMP_MS);
      cab.setLever(a);
      if (a < 1) return;
      clearInterval(id);
      cab.setLever(0);
      pull();
      reels = reels.map((r, i) => (r.running ? { ...r, target: DEMO_WORDS[i] } : r));
    }, 16);
  },
  stop: ({ reel }) => press(reel),
  idea,
  // 指の印を出して、受け皿のコインをなぞる（本物のポインタ操作を cabinet.js に送る）
  sweep() {
    const cv = $('cv'), finger = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'demo-finger' }));
    const t0 = performance.now(), fire = (type, p) => {
      const r = cv.getBoundingClientRect(), x = r.left + p.x / cabW * r.width, y = r.top + p.y / 190 * r.height;
      finger.style.cssText = `left:${x}px;top:${y}px`;
      cv.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerType: 'touch', bubbles: true }));
    };
    fire('pointerdown', sweepAt(0, cabW));
    const id = setInterval(() => {
      const a = Math.min(1, (performance.now() - t0) / SWEEP_MS), p = sweepAt(a, cabW);
      fire('pointermove', p);
      if (a < 1) return;
      clearInterval(id);
      fire('pointerup', p);
      finger.remove();
    }, 16);
  },
  end() { if (mode.loop) playDemo(); },
};
function playDemo() {
  for (const s of DEMO_SCRIPT) setTimeout(() => demoActs[s.act](s), s.at);
}

function fail() {
  boot.hide(true); // 読み込み画面を消して、このエラーを見せる
  app.innerHTML = '<div class="error"><p>データを読み込めませんでした</p><button class="sbtn" id="reload">再読み込み</button></div>';
  $('reload').onclick = () => location.reload();
}

async function load() {
  try {
    // 読み込み画面の「n / 6」は、読み終えたファイルの数（boot は全部で 6 つと数える）
    const [words, verbs, genres, tags, games, extra] = await Promise.all([
      ...['words', 'verbs', 'genres', 'tags', 'games'].map(n => fetch(`data/${n}.json`).then(r => { if (!r.ok) throw new Error(n); return r.json(); }).finally(boot.step)),
      // テーマ集は無くても続行（全部空のテーマ）
      fetch('data/extra.json').then(r => (r.ok ? r.json() : {})).catch(() => ({})).finally(boot.step),
    ]);
    data = { words, verbs, genres, tags, games, extra };
  } catch {
    fail();
    return;
  }
  start().catch(fail);
}
load();
