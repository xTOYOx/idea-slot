import { TYPE_LABELS, TYPE_KEYS } from './types.js';
import { buildPools } from './pools.js';
import { spin, rerollOne, setSlotType, resizeSlots } from './pick.js';
import { createStore } from './store.js';

let ls = null;
try { ls = localStorage; } catch { /* memory only */ }
const store = createStore(ls);
const app = document.getElementById('app');

// --- app state (module scope so Task 6 dialogs can use it and call render()) ---
let data = null;
let pools = null;
let slots = [];
let spinning = false;
let menuIndex = null; // slot whose word menu is open
let spinText = [];    // texts shown while spinning

const clamp = n => (Number.isInteger(n) ? Math.min(4, Math.max(2, n)) : 3);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rebuildPools = () => { pools = buildPools(data, store.state.custom, store.state.excluded); };

function saveSettings() {
  const s = store.state.settings;
  s.count = slots.length;
  s.slots = slots.map(({ type }) => ({ type }));
  store.save('settings');
}

function initSlots() {
  const saved = store.state.settings.slots.map(s => ({
    type: TYPE_KEYS.includes(s?.type) ? s.type : 'any', value: null, held: false,
  }));
  slots = resizeSlots(saved, clamp(store.state.settings.count));
}

function render() {
  if (!data) return;
  const done = slots.every(s => s.value);
  const reels = slots.map((s, i) => {
    const text = spinning && !s.held ? spinText[i] : s.value;
    const word = text
      ? `<button class="word${spinning ? ' spinning' : ''}" data-act="word" data-i="${i}">${esc(text)}</button>`
      : `<div class="word empty">語がありません</div>`;
    const menu = menuIndex === i && !spinning
      ? `<div class="menu"><button data-act="exclude" data-i="${i}">この語を除外</button><button data-act="reroll" data-i="${i}">この枠だけ振り直す</button></div>` : '';
    const opts = TYPE_KEYS.map(k => `<option value="${k}"${k === s.type ? ' selected' : ''}>${esc(TYPE_LABELS[k])}</option>`).join('');
    return `${i ? '<div class="sep">×</div>' : ''}<div class="reel">
      <select data-act="type" data-i="${i}">${opts}</select>${word}${menu}
      <button class="hold${s.held ? ' on' : ''}" data-act="hold" data-i="${i}" aria-pressed="${s.held}">HOLD</button></div>`;
  }).join('');
  const counts = [2, 3, 4].map(n => `<button data-act="count" data-n="${n}" class="${n === slots.length ? 'on' : ''}">${n}</button>`).join('');
  const history = store.state.history.map((c, i) => `<li><button data-act="restore" data-i="${i}">${esc(c.join(' × '))}</button></li>`).join('');
  app.innerHTML = `<div class="counts">枠の数 ${counts}</div>
    <div class="reels">${reels}</div>
    <div class="actions"><button class="go" data-act="spin">かけ合わせる！</button>
      <button data-act="fav"${done ? '' : ' disabled'}>☆ お気に入り</button></div>
    <h2>履歴</h2><ol class="history">${history}</ol>`;
}

function finish(result) {
  slots = result;
  spinning = false;
  if (slots.every(s => s.value)) store.pushHistory(slots.map(s => s.value));
  render();
}

function doSpin() {
  if (spinning || !data) return;
  menuIndex = null;
  const result = spin(slots, pools);
  if (!store.state.settings.animate) return finish(result);
  spinning = true;
  const pick = i => { const p = pools[slots[i].type]; return p.length ? p[Math.floor(Math.random() * p.length)] : ''; };
  const ticker = setInterval(() => { spinText = slots.map((_, i) => pick(i)); render(); }, 60);
  spinText = slots.map((_, i) => pick(i));
  // a reel stops by being marked held (frozen on its final value); finish() restores real flags
  result.forEach((r, i) => setTimeout(() => {
    slots = slots.map((s, j) => (j === i ? { ...s, value: r.value, held: true } : s));
    if (i === slots.length - 1) { clearInterval(ticker); finish(result); } else render();
  }, 300 + i * 150));
  render();
}

const actions = {
  spin: doSpin,
  count(el) { slots = resizeSlots(slots, Number(el.dataset.n)); saveSettings(); },
  type(el) { slots = setSlotType(slots, Number(el.dataset.i), el.value); saveSettings(); },
  hold(el) { const i = Number(el.dataset.i); slots = slots.map((s, j) => (j === i ? { ...s, held: !s.held } : s)); },
  word(el) { const i = Number(el.dataset.i); menuIndex = menuIndex === i ? null : i; },
  reroll(el) { slots = rerollOne(slots, Number(el.dataset.i), pools); menuIndex = null; },
  exclude(el) {
    const i = Number(el.dataset.i);
    store.state.excluded = [...store.state.excluded, slots[i].value];
    store.save('excluded');
    rebuildPools();
    slots = rerollOne(slots.map((s, j) => (j === i ? { ...s, value: null } : s)), i, pools);
    menuIndex = null;
  },
  fav() {
    store.state.favorites = [{ combo: slots.map(s => s.value), memo: '', savedAt: Date.now() }, ...store.state.favorites];
    store.save('favorites');
  },
  restore(el) {
    const combo = store.state.history[Number(el.dataset.i)];
    slots = resizeSlots(slots, clamp(combo.length)).map((s, i) => ({ ...s, value: combo[i] ?? null, held: false }));
    saveSettings();
  },
};

app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'SELECT' || spinning) return;
  actions[el.dataset.act](el);
  render();
});
app.addEventListener('change', e => {
  const el = e.target.closest('[data-act="type"]');
  if (el && !spinning) { actions.type(el); render(); } else if (el) render();
});
document.addEventListener('click', e => {
  if (menuIndex !== null && !e.target.closest('.menu, .word')) { menuIndex = null; render(); }
});
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || e.target.closest('button, select, input, textarea, dialog')) return;
  e.preventDefault();
  doSpin();
});
for (const b of document.querySelectorAll('[data-open]')) b.onclick = () => document.getElementById(b.dataset.open).showModal();
for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => b.closest('dialog').close();

async function load() {
  try {
    const [words, verbs, genres, tags] = await Promise.all(
      ['words', 'verbs', 'genres', 'tags'].map(n => fetch(`data/${n}.json`).then(r => { if (!r.ok) throw new Error(n); return r.json(); })));
    data = { words, verbs, genres, tags };
  } catch {
    app.innerHTML = '<div class="error"><p>データを読み込めませんでした</p><button id="reload">再読み込み</button></div>';
    document.getElementById('reload').onclick = () => location.reload();
    return;
  }
  rebuildPools();
  initSlots();
  saveSettings();
  slots = spin(slots, pools);
  render();
}
load();
