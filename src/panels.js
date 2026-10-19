// ポーズメニューと引き出し（履歴・当たり帳）。DOM だけを扱い、中身の描画と状態は app.js が持つ。
// pauseAction(key): ポーズメニューの auto / snd / rm が押された。open(): ポーズを開く直前（ラベル更新用）
export function initPanels({ pauseAction, open }) {
  const pause = document.getElementById('pause');
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
  const panels = {
    openPause() { open(); if (!pause.open) pause.showModal(); },
    closePause() { pause.close(); },
    openDrawer: name => setDrawer(name, true),
    // 一番上の引き出しを閉じる。閉じたら true
    closeTop() { if (!order.length) return false; setDrawer(order.at(-1), false); return true; },
    closeAll(back = true) { [...order].forEach(n => setDrawer(n, false, { back })); },
    toggleDrawer: name => setDrawer(name, !isOpen(name)),
    setCount(name, n) { drawers[name].querySelector('.bdg').textContent = n; },
    flash(name) {
      const t = drawers[name].querySelector('.dtab');
      t.classList.remove('flash');
      void t.offsetWidth;
      t.classList.add('flash');
    },
  };

  for (const [name, el] of Object.entries(drawers)) {
    el.querySelector('.dtab').addEventListener('click', e => { if (e.detail > 0) e.currentTarget.blur(); panels.toggleDrawer(name); });
    el.querySelector('[data-dclose]').addEventListener('click', e => { if (e.detail > 0) e.currentTarget.blur(); setDrawer(name, false); });
  }
  // 外側をクリックしたら閉じる（引き出しの中とダイアログの中は除く）
  document.addEventListener('click', e => { if (!e.target.closest('.drawer, dialog')) panels.closeAll(); });

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
    else if (p === 'hits' || p === 'hist') { pause.close(); setDrawer(p, true, { from: b }); }
    else if (p) pauseAction(p);
  });
  // テーマ・書き出し: 開けるときだけポーズを閉じる（開くのは screens.js / themescreen.js の onclick）
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
    dlg.addEventListener('close', () => backToPause(b));
  }
  return panels;
}
