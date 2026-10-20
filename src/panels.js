// ポーズメニューと引き出し（履歴・テンプレート・当たり帳）。DOM だけを扱い、中身の描画と状態は app.js が持つ。
// スマホの縦画面（幅 600 未満）は引き出しを使わず、筐体の下の一覧を3つのタブ（#ptabs）で切り替える（同じ中身を CSS で並べ替えるだけ）。
// pauseAction(key): ポーズメニューの auto / snd / rm が押された。open(): ポーズを開く直前（ラベル更新用）
// tab: 最初に開く一覧のタブ。onTab(name): タブが切り替わった（覚えておく用）
export function initPanels({ pauseAction, open, tab, onTab }) {
  const pause = document.getElementById('pause');
  const narrow = matchMedia('(max-width: 599px)');
  const ptabs = Object.fromEntries([...document.querySelectorAll('#ptabs [data-t]')].map(b => [b.dataset.t, b]));
  const drawers = Object.fromEntries([...document.querySelectorAll('.drawer')].map(el => [el.dataset.d, el]));
  const order = []; // 開いている引き出し（開いた順。いちばん後ろが一番上）
  const via = {}; // ポーズから開いた引き出し → 押したポーズの項目。閉じたらポーズに戻る

  const isOpen = name => order.includes(name);
  // from: ポーズから開くときに押した項目。閉じるとポーズに戻る（back=false なら戻らない）
  function setDrawer(name, on, { from, back = true } = {}) {
    const el = drawers[name];
    if (on === isOpen(name)) return;
    if (on) order.push(name); else order.splice(order.indexOf(name), 1);
    el.classList.toggle('open', on);
    order.forEach((n, i) => { drawers[n].style.zIndex = 5 + i; }); // 開いた順に重ねる（閉じた引き出しのタブは CSS で最前面）
    if (!on) el.style.zIndex = '';
    el.querySelector('.dbody').inert = !on;
    el.querySelector('.dtab').setAttribute('aria-expanded', String(on));
    const b = on ? from : via[name];
    if (on) via[name] = from; else delete via[name];
    el.querySelector('[data-dclose]').textContent = on && from ? '← もどる' : '閉じる';
    if (!on && back && b) backToPause(b);
  }
  // ポーズを開き直し、さっき押した項目にフォーカスを置く（showModal が先頭へ置くので、そのあとで）
  function backToPause(b) {
    if (pause.open) return;
    panels.openPause();
    b.focus({ preventScroll: true });
  }
  // 一覧のタブを切り替える（スマホ縦）。表示の出し分けは CSS（body[data-pt]）
  function setTab(name) {
    const changed = name !== tab;
    tab = name;
    document.body.dataset.pt = name;
    for (const [n, b] of Object.entries(ptabs)) b.setAttribute('aria-pressed', String(n === name));
    if (changed) onTab?.(name);
  }
  // 幅 600 をまたいだら、左右の引き出し（開いていたものは閉じる）と下の一覧を切り替える。一覧の中身は引き出しと同じなので、スマホでは触れるように inert を外す
  function applyMode() {
    panels.closeAll(false);
    for (const el of Object.values(drawers)) el.querySelector('.dbody').inert = !narrow.matches;
  }
  const panels = {
    openPause() { open(); if (!pause.open) pause.showModal(); },
    closePause() { pause.close(); },
    // 一番上の引き出しを閉じる。閉じたら true
    closeTop() { if (!order.length) return false; setDrawer(order.at(-1), false); return true; },
    closeAll(back = true) { [...order].forEach(n => setDrawer(n, false, { back })); },
    toggleDrawer: name => (narrow.matches ? setTab(name) : setDrawer(name, !isOpen(name))), // スマホは、その一覧のタブを開く
    setCount(name, n) { for (const b of [drawers[name].querySelector('.bdg'), ptabs[name]?.querySelector('.bdg')]) if (b) b.textContent = n; },
    flash(name) {
      for (const t of [drawers[name].querySelector('.dtab'), ptabs[name]]) {
        t.classList.remove('flash');
        void t.offsetWidth;
        t.classList.add('flash');
      }
    },
  };
  for (const [name, b] of Object.entries(ptabs)) b.addEventListener('click', e => { if (e.detail > 0) e.currentTarget.blur(); setTab(name); });
  narrow.addEventListener('change', applyMode);
  setTab(tab);
  applyMode();

  for (const [name, el] of Object.entries(drawers)) {
    el.querySelector('.dtab').addEventListener('click', e => { if (e.detail > 0) e.currentTarget.blur(); panels.toggleDrawer(name); });
    el.querySelector('[data-dclose]').addEventListener('click', e => { if (e.detail > 0) e.currentTarget.blur(); setDrawer(name, false); });
  }
  // 外側をクリックしたら閉じる（引き出しの中とダイアログの中は除く）
  // composedPath: 中のボタンが描き直しで外れたあとでも、元の親をたどれる
  // テンプレの引き出しは、筐体（#wrap）を操作しても閉じない（リールやテーマを変えながら構成を保存できるように）
  document.addEventListener('click', e => {
    const path = e.composedPath();
    if (path.some(n => n.matches?.('.drawer, dialog'))) return;
    const keepTpl = path.some(n => n.id === 'wrap');
    [...order].forEach(n => { if (!(keepTpl && n === 'tpl')) setDrawer(n, false); });
  });

  document.getElementById('pbtn').addEventListener('click', e => { if (e.detail > 0) e.currentTarget.blur(); panels.openPause(); });
  pause.addEventListener('click', e => {
    if (e.target === pause) { // パネルの余白かバックドロップか: 座標で外側だけ閉じる
      const r = pause.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) pause.close();
      return;
    }
    const b = e.target.closest('button');
    if (!b) return;
    if (e.detail > 0) b.blur();
    const p = b.dataset.p;
    if (p === 'resume') pause.close();
    else if (p in drawers) { pause.close(); setDrawer(p, true, { from: b }); }
    else if (p) pauseAction(p);
  });
  // テーマ・キー設定・書き出し: 開けるときだけポーズを閉じる（開くのは各画面の onclick）
  pause.addEventListener('click', e => { if (e.target.closest('[data-open]:not(:disabled)')) pause.close(); }, true);
  // ポーズを閉じたとき、フォーカスが閉じたダイアログの中の項目に残っていると Esc（app.js の keydown）が効かなくなるので外す
  pause.addEventListener('close', () => {
    const a = document.activeElement;
    if (!document.querySelector('dialog[open]') && a?.closest('dialog')) a.blur();
  });
  // その画面を閉じたら（もどる・Esc・外側のクリック）ポーズに戻る
  for (const b of pause.querySelectorAll('[data-open]')) {
    const dlg = document.getElementById(b.dataset.open);
    let down = null; // 押し始めた所: 中で押してドラッグしたまま外で離したときは閉じない
    dlg.addEventListener('pointerdown', e => { down = e.target; });
    dlg.addEventListener('click', e => {
      if (e.target !== dlg || down !== dlg) return;
      const r = dlg.getBoundingClientRect(); // パネルの余白かバックドロップか: 座標で外側だけ閉じる
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
    });
    dlg.addEventListener('close', () => { if (dlg.dataset.nb === undefined) backToPause(b); }); // data-nb: ポーズ以外から開いた（使い方から開いた「このアプリについて」）
  }
  return panels;
}
