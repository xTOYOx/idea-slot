// localStorage persistence (DOM-free). `storage` has getItem/setItem, or is null for memory-only.
import { DEFAULT_KEYS, normalizeKeys } from './keys.js';
import { cleanTemplate } from './templates.js';

const KEYS = ['settings', 'history', 'favorites', 'custom', 'excluded', 'stats', 'themes', 'templates'];
const HISTORY_MAX = 100;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;

const defaults = () => ({
  settings: { count: 3, slots: [{ type: 'any' }, { type: 'any' }, { type: 'any' }], autoStop: false, sound: true, reduceMotion: false, width: 620, cabW: null, keys: { ...DEFAULT_KEYS } },
  history: [],
  favorites: [],
  custom: {},
  excluded: [],
  stats: { spins: 0 },
  themes: [],
  templates: [],
});

// Settings: current shape passes through; v1 (`animate` only) migrates to `reduceMotion = !animate`.
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
const normalizeSettings = v => {
  if (!isObj(v) || typeof v.count !== 'number' || !isArr(v.slots)) return null;
  return {
    count: v.count,
    slots: v.slots,
    autoStop: bool(v.autoStop, false),
    sound: bool(v.sound, true),
    reduceMotion: bool(v.reduceMotion, typeof v.animate === 'boolean' ? !v.animate : false),
    width: Number.isFinite(v.width) ? Math.min(1400, Math.max(460, Math.round(v.width))) : 620, // PC での横幅(px)
    cabW: Number.isFinite(v.cabW) ? Math.max(200, Math.round(v.cabW)) : null, // 筐体の論理幅（null = 画面に合わせて自動）
    keys: normalizeKeys(v.keys), // キー設定（操作 → KeyboardEvent.code）
  };
};

// Each normalizer returns the value to store, or null when `v` is unusable.
const keep = ok => v => (ok(v) ? v : null);
const isStrs = v => isArr(v) && v.every(s => typeof s === 'string');
const fav = f => (isObj(f) && isStrs(f.combo)
  ? { combo: f.combo, memo: typeof f.memo === 'string' ? f.memo : '', savedAt: typeof f.savedAt === 'number' ? f.savedAt : 0 }
  : null);
// 名前・語は前後の空白を除く（名前が空なら不正、語は空を捨てて重複を除く）
const theme = t => {
  if (!isObj(t) || typeof t.name !== 'string' || !isStrs(t.words) || !t.name.trim()) return null;
  return { name: t.name.trim(), words: [...new Set(t.words.map(w => w.trim()).filter(Boolean))] };
};
// `strict` (import): one bad entry rejects the whole value. Otherwise (load) bad entries are dropped.
const normalize = {
  settings: normalizeSettings,
  history: keep(v => isArr(v) && v.every(isArr)),
  favorites: (v, strict) => {
    if (!isArr(v)) return null;
    const list = v.map(fav);
    return list.includes(null) && strict ? null : list.filter(Boolean);
  },
  custom: (v, strict) => {
    if (!isObj(v)) return null;
    const entries = Object.entries(v);
    return strict && !entries.every(([, w]) => isStrs(w)) ? null : Object.fromEntries(entries.filter(([, w]) => isStrs(w)));
  },
  excluded: keep(isArr),
  // 自作テーマ。名前は一覧の中で重複しない。読み込みでは不正・重複を落とし、インポートでは拒否する
  themes: (v, strict) => {
    if (!isArr(v)) return null;
    const list = v.map(theme), names = new Set(), ok = [];
    for (const t of list) if (t && !names.has(t.name)) { names.add(t.name); ok.push(t); }
    return strict && ok.length !== v.length ? null : ok;
  },
  // リールのテンプレート。themes と同じく名前は重複しない。読み込みでは不正・重複を落とし、インポートでは拒否する
  templates: (v, strict) => {
    if (!isArr(v)) return null;
    const names = new Set(), ok = [];
    for (const t of v.map(cleanTemplate)) if (t && !names.has(t.name)) { names.add(t.name); ok.push(t); }
    return strict && ok.length !== v.length ? null : ok;
  },
  stats: keep(v => isObj(v) && Number.isInteger(v.spins) && v.spins >= 0),
};

export function createStore(storage) {
  const state = defaults();

  for (const key of KEYS) {
    try {
      const v = JSON.parse(storage.getItem('slot.' + key));
      state[key] = normalize[key](v, false) ?? state[key];
    } catch { /* missing, broken or inaccessible → default */ }
  }

  const save = key => {
    try { storage.setItem('slot.' + key, JSON.stringify(state[key])); } catch { /* memory only */ }
  };

  return {
    state,
    save,
    pushHistory(combo) {
      state.history = [combo, ...state.history].slice(0, HISTORY_MAX);
      save('history');
    },
    // 語を「除外」から外す（自作テーマに足した語を出るようにする）
    unexclude(words) {
      const next = state.excluded.filter(w => !words.includes(w));
      if (next.length === state.excluded.length) return;
      state.excluded = next;
      save('excluded');
    },
    countSpin() {
      state.stats.spins++;
      save('stats');
    },
    exportJSON: () => JSON.stringify({ app: 'idea-slot', version: 3, ...state }),
    importJSON(text) {
      let data;
      try { data = JSON.parse(text); } catch { return { ok: false, error: 'JSONとして読めません' }; }
      if (!isObj(data) || data.app !== 'idea-slot') return { ok: false, error: 'アイデアスロットのファイルではありません' };
      const next = {};
      for (const key of KEYS) {
        // Older files lack stats (v1), themes (v1/v2) or templates: fall back to the initial value.
        next[key] = (key === 'stats' || key === 'themes' || key === 'templates') && data[key] === undefined ? defaults()[key] : normalize[key](data[key], true);
        if (next[key] === null) return { ok: false, error: `${key} の形が正しくありません` };
      }
      for (const key of KEYS) { state[key] = next[key]; save(key); }
      return { ok: true };
    },
  };
}
