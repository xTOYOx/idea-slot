// localStorage persistence (DOM-free). `storage` has getItem/setItem, or is null for memory-only.
const KEYS = ['settings', 'history', 'favorites', 'custom', 'excluded', 'stats'];
const HISTORY_MAX = 100;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;

const defaults = () => ({
  settings: { count: 3, slots: [{ type: 'any' }, { type: 'any' }, { type: 'any' }], autoStop: false, sound: true, reduceMotion: false },
  history: [],
  favorites: [],
  custom: {},
  excluded: [],
  stats: { spins: 0 },
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
  };
};

// Each normalizer returns the value to store, or null when `v` is unusable.
const keep = ok => v => (ok(v) ? v : null);
const isStrs = v => isArr(v) && v.every(s => typeof s === 'string');
const fav = f => (isObj(f) && isStrs(f.combo)
  ? { combo: f.combo, memo: typeof f.memo === 'string' ? f.memo : '', savedAt: typeof f.savedAt === 'number' ? f.savedAt : 0 }
  : null);
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
    countSpin() {
      state.stats.spins++;
      save('stats');
    },
    exportJSON: () => JSON.stringify({ app: 'idea-slot', version: 2, ...state }),
    importJSON(text) {
      let data;
      try { data = JSON.parse(text); } catch { return { ok: false, error: 'JSONとして読めません' }; }
      if (!isObj(data) || data.app !== 'idea-slot') return { ok: false, error: 'アイデアスロットのファイルではありません' };
      const next = {};
      for (const key of KEYS) {
        // v1 files have no stats: fall back to the initial value.
        next[key] = key === 'stats' && data.stats === undefined ? defaults().stats : normalize[key](data[key], true);
        if (next[key] === null) return { ok: false, error: `${key} の形が正しくありません` };
      }
      for (const key of KEYS) { state[key] = next[key]; save(key); }
      return { ok: true };
    },
  };
}
