// 初めての人向けの案内。指している部品を明るく囲み、吹き出しで「次へ」「スキップ」を出す（Esc でも終わる）。
// 画面全体の <dialog>（showModal）なので、案内の間は後ろの画面を触れず、キー操作も効かない。吹き出しの位置は tip.js と同じ式。
import { placeTip } from './tip.js';

// 画面（vw×vh）全体から、rects（{left, top, right, bottom}）の部分だけ抜いた clip-path
export const holePath = (rects, vw, vh) =>
  `path(evenodd, 'M0 0H${vw}V${vh}H0Z${rects.map(r => ` M${r.left} ${r.top}H${r.right}V${r.bottom}H${r.left}Z`).join('')}')`;

export const unionRect = rects => ({
  left: Math.min(...rects.map(r => r.left)), top: Math.min(...rects.map(r => r.top)),
  right: Math.max(...rects.map(r => r.right)), bottom: Math.max(...rects.map(r => r.bottom)),
});

// 各ステップ: find(narrow) → 指す要素、text(narrow) → 説明。スマホ（narrow）は端のタブが無いので、ポーズボタンを指す
const q = sel => [...document.querySelectorAll(sel)].slice(0, 1);
const STEPS = [
  { find: () => q('#lev'), text: n => (n ? 'レバーを下へ引くか、下の SPIN ボタンで回します。' : 'レバーを下へ引く（またはスペースキー）で回します。') },
  { find: () => q('.sb .f'), text: () => '回っている間に STOP で止めます。気に入った語は LOCK で固定。次に回しても動きません。' },
  { find: () => q('#idea'), text: () => 'いい組み合わせができたら IDEA! で当たり帳へ。' },
  { find: () => q('.mon'), text: () => 'モニターを押すと、リールごとにテーマを選べます。' },
  { find: n => (n ? q('#pbtn') : [...document.querySelectorAll('.dtab')]), text: n => (n ? '左上の ⏸ から、履歴・テンプレート・当たり帳を開けます。' : '左右の端のタブで、履歴・テンプレート・当たり帳を開けます。') },
];

const PAD = 4;
// onDone: 最後まで見た・スキップ・Esc のどれで終わっても呼ぶ（「案内を見た」を保存する）
export function createTour(onDone) {
  const dlg = Object.assign(document.createElement('dialog'), { id: 'tour', innerHTML:
    '<div class="tdim"></div><div class="tbal"><p class="tn"></p><p class="tt"></p><div class="row"><button data-skip>スキップ</button><button data-next></button></div></div>' });
  dlg.setAttribute('aria-label', 'はじめての案内');
  document.body.append(dlg);
  const dim = dlg.querySelector('.tdim'), bal = dlg.querySelector('.tbal'), next = dlg.querySelector('[data-next]');
  let list = [], at = 0;

  function render() {
    const narrow = matchMedia('(max-width: 599px)').matches, d = document.documentElement, vw = d.clientWidth, vh = d.clientHeight;
    const step = list[at], els = step.find(narrow);
    const rects = els.map(el => el.getBoundingClientRect()).filter(r => r.width && r.height)
      .map(r => ({ left: r.left - PAD, top: r.top - PAD, right: r.right + PAD, bottom: r.bottom + PAD }));
    dlg.querySelectorAll('.tbox').forEach(b => b.remove());
    for (const r of rects) dlg.append(Object.assign(document.createElement('div'), { className: 'tbox', style: `left:${r.left}px;top:${r.top}px;width:${r.right - r.left}px;height:${r.bottom - r.top}px` }));
    dim.style.clipPath = holePath(rects, vw, vh);
    bal.querySelector('.tn').textContent = `${at + 1} / ${list.length}`;
    bal.querySelector('.tt').textContent = step.text(narrow);
    next.textContent = at === list.length - 1 ? 'はじめる' : '次へ';
    bal.style.cssText = 'left:0;top:0;visibility:hidden';
    const s = bal.getBoundingClientRect(), p = placeTip(rects.length ? unionRect(rects) : { left: vw / 2, right: vw / 2, top: vh / 2, bottom: vh / 2 }, { w: s.width, h: s.height }, { w: vw, h: vh });
    bal.style.cssText = `left:${p.left}px;top:${p.top}px`;
    next.focus({ preventScroll: true });
  }

  dlg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-skip') || at === list.length - 1) dlg.close();
    else { at++; render(); }
  });
  dlg.addEventListener('close', () => onDone());
  addEventListener('resize', () => { if (dlg.open) render(); });

  return {
    // 指す要素が無い（まだ組み立て前など）ステップは飛ばす
    start() {
      const narrow = matchMedia('(max-width: 599px)').matches;
      list = STEPS.filter(s => s.find(narrow).length);
      if (!list.length || dlg.open) return;
      at = 0;
      dlg.showModal();
      render();
    },
  };
}
