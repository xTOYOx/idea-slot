// localStorage persistence (DOM-free). `storage` has getItem/setItem, or is null for memory-only.
const KEYS = ['settings', 'history', 'favorites', 'custom', 'excluded'];
const HISTORY_MAX = 100;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;

const defaults = () => ({
  settings: { count: 3, slots: [{ type: 'any' }, { type: 'any' }, { type: 'any' }], animate: true },
  history: [],
  favorites: [],
  custom: {},
  excluded: [],
});

const valid = {
  settings: v => isObj(v) && typeof v.count === 'number' && isArr(v.slots) && typeof v.animate === 'boolean',
  history: v => isArr(v) && v.every(isArr),
  favorites: isArr,
  custom: isObj,
  excluded: isArr,
};

export function createStore(storage) {
  const state = defaults();

  for (const key of KEYS) {
    try {
      const v = JSON.parse(storage.getItem('slot.' + key));
      if (valid[key](v)) state[key] = v;
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
    exportJSON: () => JSON.stringify({ app: 'idea-slot', version: 1, ...state }),
    importJSON(text) {
      let data;
      try { data = JSON.parse(text); } catch { return { ok: false, error: 'JSONとして読めません' }; }
      if (!isObj(data) || data.app !== 'idea-slot') return { ok: false, error: 'アイデアスロットのファイルではありません' };
      for (const key of KEYS) if (!valid[key](data[key])) return { ok: false, error: `${key} の形が正しくありません` };
      for (const key of KEYS) { state[key] = data[key]; save(key); }
      return { ok: true };
    },
  };
}
