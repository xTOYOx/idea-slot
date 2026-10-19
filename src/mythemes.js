// 自作テーマ（{name, words}）の純粋な操作。引数は変えず、新しい値を返す。
export const parseWords = text => [...new Set(String(text).split(/[\n\r、,，]/).map(w => w.trim()).filter(Boolean))];

export function addWords(theme, words) {
  const have = new Set(theme.words), fresh = [...new Set(words)].filter(w => !have.has(w));
  return { theme: { ...theme, words: [...theme.words, ...fresh] }, added: fresh.length };
}

export const removeWord = (theme, word) => ({ ...theme, words: theme.words.filter(w => w !== word) });

// 名前が空か、ほかのテーマと重なれば null
export function createTheme(themes, name) {
  name = name.trim();
  return !name || themes.some(t => t.name === name) ? null : [...themes, { name, words: [] }];
}

export function renameTheme(themes, old, next) {
  next = next.trim();
  if (!next || !themes.some(t => t.name === old) || (next !== old && themes.some(t => t.name === next))) return null;
  return themes.map(t => (t.name === old ? { ...t, name: next } : t));
}

export const deleteTheme = (themes, name) => themes.filter(t => t.name !== name);
