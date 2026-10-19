// 語の意味の吹き出し。PC はマウスを 0.4 秒乗せる、スマホは 0.5 秒の長押し（そのときはクリック＝コピーをさせない）で出す。
const HOVER_MS = 400, PRESS_MS = 500, MOVE_PX = 10, MARGIN = 8, GAP = 8;

// 吹き出しの左上の位置。アンカーの真ん中・下が基本、入らなければ上。画面（vp）からはみ出さない
export function placeTip(a, size, vp) {
  const fit = (v, len, max) => Math.max(MARGIN, Math.min(v, max - len - MARGIN));
  const left = fit((a.left + a.right) / 2 - size.w / 2, size.w, vp.w);
  const below = a.bottom + GAP, above = a.top - GAP - size.h;
  const top = below + size.h + MARGIN <= vp.h ? below : above >= MARGIN ? above : fit(below, size.h, vp.h);
  return { left, top };
}

// lookup(語) → Promise<意味 | null>、wordOf(要素) → いま出してよい語（回転中・空なら null）。意味が無い語は何も出さない
export function createTip(lookup, wordOf) {
  const box = Object.assign(document.createElement('div'), { id: 'tip', hidden: true });
  box.setAttribute('role', 'tooltip');
  document.body.append(box);
  let cur = null, timer = 0, token = 0, press = null, suppressUntil = 0, lastType = 'mouse';

  function hide() {
    clearTimeout(timer);
    token++;
    cur?.el.removeAttribute('aria-describedby');
    cur = null;
    box.hidden = true;
  }
  async function show(el) {
    const word = wordOf(el);
    hide();
    if (!word) return;
    const mine = token, text = await lookup(word);
    if (mine !== token || !text || wordOf(el) !== word || !el.isConnected) return;
    const b = Object.assign(document.createElement('b'), { textContent: word });
    box.replaceChildren(b, Object.assign(document.createElement('div'), { textContent: text }));
    box.style.cssText = 'left:0;top:0;visibility:hidden';
    box.hidden = false;
    const r = box.getBoundingClientRect(), d = document.documentElement;
    const p = placeTip(el.getBoundingClientRect(), { w: r.width, h: r.height }, { w: d.clientWidth, h: d.clientHeight });
    box.style.cssText = `left:${p.left}px;top:${p.top}px`;
    el.setAttribute('aria-describedby', 'tip');
    cur = { el, word };
  }

  // 出ている間に語が変わった・回り始めた・要素が消えたら消す
  const check = () => { if (cur && (!cur.el.isConnected || wordOf(cur.el) !== cur.word)) hide(); };

  document.addEventListener('pointerdown', hide, true); // 押したら（どこでも）消す。部品側の処理より先に
  document.addEventListener('scroll', hide, true);
  addEventListener('resize', hide);
  addEventListener('keydown', hide);
  addEventListener('blur', hide);

  // root の中の selector に合う要素（語）に対応する
  function attach(root, selector) {
    root.addEventListener('pointerover', (e) => {
      const t = e.pointerType === 'mouse' && e.target.closest(selector);
      if (!t || t.contains(e.relatedTarget)) return;
      hide();
      timer = setTimeout(() => show(t), HOVER_MS);
    });
    root.addEventListener('pointerout', (e) => {
      const t = e.pointerType === 'mouse' && e.target.closest(selector);
      if (t && !t.contains(e.relatedTarget)) hide();
    });
    root.addEventListener('pointerdown', (e) => {
      lastType = e.pointerType;
      const t = e.pointerType !== 'mouse' && e.isPrimary && e.target.closest(selector);
      if (!t) return;
      const mine = press = { id: e.pointerId, x: e.clientX, y: e.clientY, long: false };
      timer = setTimeout(() => { mine.long = true; show(t); }, PRESS_MS);
    });
    root.addEventListener('pointermove', (e) => {
      if (press && e.pointerId === press.id && !press.long && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_PX) { clearTimeout(timer); press = null; }
    });
    const end = (e) => {
      if (!press || e.pointerId !== press.id) return;
      clearTimeout(timer);
      if (press.long) suppressUntil = e.timeStamp + 600; // 長押しのあとに来るクリックを止める（コピーしない）
      press = null;
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    // 長押しで出るメニュー・クリックを止める（クリックは、押している途中で来る分だけ）
    root.addEventListener('contextmenu', (e) => { if (lastType !== 'mouse' && e.target.closest(selector)) e.preventDefault(); });
    root.addEventListener('click', (e) => {
      if (e.timeStamp < suppressUntil && e.target.closest(selector)) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  }
  return { attach, check, hide };
}
