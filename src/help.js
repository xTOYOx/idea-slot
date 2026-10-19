// 「使い方」ダイアログ。左上の「？」かキーで開く（ポーズの外なので、閉じるは「閉じる」）。中身は index.html にある。
// setKeys(lines): 「キー操作」の行を差し替える（キー設定から作る）。open(): キーから開く
export function initHelp() {
  const dlg = document.getElementById('help'), btn = document.getElementById('hbtn');
  btn.addEventListener('click', e => {
    e.stopPropagation(); // 開いている引き出しを閉じる処理（panels.js）に渡さない。閉じたら引き出しがそのまま見える
    if (e.detail > 0) btn.blur();
    dlg.showModal();
  });
  dlg.querySelector('[data-close]').onclick = () => dlg.close();
  let down = null; // 中で押して外で離したときは閉じない
  dlg.addEventListener('pointerdown', e => { down = e.target; });
  dlg.addEventListener('click', e => {
    if (e.target !== dlg || down !== dlg) return;
    const r = dlg.getBoundingClientRect(); // 余白かバックドロップか: 座標で外側だけ閉じる
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });
  return {
    open: () => dlg.showModal(),
    setKeys: lines => dlg.querySelector('#help-keys').replaceChildren(...lines.map(s => Object.assign(document.createElement('li'), { textContent: s }))),
  };
}
