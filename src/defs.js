// 語の意味（data/defs/NN.json）。語から決まる簡単なハッシュで 64 個のファイルに分け、使う語のファイルだけを読んで覚えておく。
// shardOf・groupByShard は tools/build-defs.mjs と共有する（同じ語が同じファイルに入るように）。
export const SHARDS = 64;

// FNV-1a。ファイル名は 2桁の16進（00 … 3f）
export function shardOf(word) {
  let h = 2166136261;
  for (let i = 0; i < word.length; i++) h = Math.imul(h ^ word.charCodeAt(i), 16777619);
  return ((h >>> 0) % SHARDS).toString(16).padStart(2, '0');
}

// [[語, 意味], …] → { '00': {語: 意味, …}, … '3f': … }。64個すべて作り、中の語は並べ替える（再生成しても差分が増えない）
export function groupByShard(entries) {
  const out = Object.fromEntries(Array.from({ length: SHARDS }, (_, i) => [i.toString(16).padStart(2, '0'), {}]));
  for (const [w, d] of [...entries].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) out[shardOf(w)][w] = d;
  return out;
}

// load(name) → Promise<{語: 意味}>。読めなかったファイルは覚えず、次の機会にやり直す
export function createDefs(load) {
  const files = new Map();
  const shard = name => {
    if (!files.has(name)) files.set(name, Promise.resolve().then(() => load(name)).catch(() => { files.delete(name); return {}; }));
    return files.get(name);
  };
  return {
    async lookup(word) {
      if (!word) return null;
      const o = await shard(shardOf(word));
      return Object.hasOwn(o, word) ? o[word] : null;
    },
  };
}
