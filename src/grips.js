// 筐体の左右の端の「つまみ」（PC のみ）。ドラッグ・キー操作・ダブルクリックを受けて、app.js に言われた関数を呼ぶだけ。
// size(): 今の W。range(): [最小, 最大]。toW(px): 表示幅(px)から W。live(w): ドラッグ中の仮の幅（null で仮を捨てる）。commit(w): 幅を決めた。reset(): 自動に戻す
const STEP = 10;

export function initGrips(wrap, { size, range, toW, live, commit, reset }) {
  const grips = [...wrap.querySelectorAll('.grip')];
  const clamp = w => Math.min(range()[1], Math.max(range()[0], w));

  for (const g of grips) {
    const sign = g.classList.contains('r') ? 1 : -1; // 右のつまみを右へ動かすと広がる。左は逆
    let drag = null;
    g.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, px: wrap.getBoundingClientRect().width, w0: size(), w: size() };
      g.classList.add('on');
    });
    g.addEventListener('pointermove', e => {
      if (!drag) return;
      const w = clamp(toW(drag.px + 2 * sign * (e.clientX - drag.x))); // 筐体は中央のまま左右対称に広がる
      if (w === drag.w) return;
      drag.w = w;
      live(w);
    });
    const end = () => {
      if (!drag) return;
      const { w, w0 } = drag;
      drag = null;
      g.classList.remove('on');
      live(null);
      if (w !== w0) commit(w); // 動かさなかったときは自動のまま
    };
    g.addEventListener('pointerup', end);
    g.addEventListener('pointercancel', end);
    g.addEventListener('dblclick', reset);
    g.addEventListener('keydown', e => {
      const d = { ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP }[e.key];
      if (d) commit(clamp(size() + d));
      else if (e.key === 'Home') reset();
      else return;
      e.preventDefault();
    });
  }

  // 表示（aria と「横幅 280」の札）を今の幅に合わせる。manual: 手動か
  return function refresh(manual) {
    const [lo, hi] = range(), w = size();
    for (const g of grips) {
      g.setAttribute('aria-valuemin', lo);
      g.setAttribute('aria-valuemax', hi);
      g.setAttribute('aria-valuenow', w);
      g.setAttribute('aria-valuetext', manual ? `${w}` : `自動（${w}）`);
      g.querySelector('b').textContent = `横幅 ${w}`;
    }
  };
}
