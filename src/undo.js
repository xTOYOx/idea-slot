// リールの結果の履歴（DOM なし）。Ctrl+Z で戻す・Ctrl+Y でやり直す
// 保存するのは止まったときの type / base / savedTheme / value / held（running などは持たない）
export const snapOf = reels => reels.map(r => ({ type: r.type, base: r.base, savedTheme: r.savedTheme, value: r.value, held: r.held }));
// 同じ結果かの判定。held は含めない（ロックだけでは1手にしない。戻すときは held も戻る）
export const sigOf = snap => JSON.stringify(snap.map(r => [r.type, r.base ?? null, r.savedTheme ?? null, r.value ?? null]));

export function createUndo(max = 50) {
  let list = [], at = -1;
  const copy = snap => snap.map(r => ({ ...r }));
  const go = d => {
    const n = at + d;
    if (n < 0 || n >= list.length) return null;
    at = n;
    return copy(list[at]);
  };
  return {
    // 今と同じ結果なら積まない（戻した直後の記録で増えない）。戻したあとに積むと、やり直しの分は捨てる
    record(snap) {
      if (at >= 0 && sigOf(list[at]) === sigOf(snap)) return false;
      list = [...list.slice(0, at + 1), copy(snap)].slice(-max);
      at = list.length - 1;
      return true;
    },
    undo: () => go(-1),
    redo: () => go(1),
    canUndo: () => at > 0,
    canRedo: () => at < list.length - 1,
  };
}
