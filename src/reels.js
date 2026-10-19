// 筐体の上に重ねるHTML（モニター・リール窓・STOP/LOCKボタン・IDEA!・掲示板・レバー・語メニュー）。
// 座標は論理200×190から%で配置する。状態は持たず、app.js から言われたとおりに表示を変えるだけ。
import { reelRects, stopRect, MONITOR_Y, MONITOR_H, REEL_Y, REEL_H, COUNT_BTN } from './layout.js';

const pos = (x, y, w, h) => `left:${x / 2}%;top:${y / 1.9}%;width:${w / 2}%;height:${h / 1.9}%`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SLOT = '<div class="e"><span></span></div>';

export function createOverlay(wrap, ov, on) {
  let rects = [], wins = [], btns = [], mons = [], menuEl = null, menuIndex = null, menuKind = null, ticker = null, plus = null, minus = null;
  const fit = () => wrap.style.setProperty('--u', wrap.clientWidth / 200 + 'px');
  fit(); // 最初の描画から合わせる（ResizeObserver の通知を待たない）
  new ResizeObserver(fit).observe(wrap);

  const view = {
    build(n) {
      rects = reelRects(n);
      ov.innerHTML = rects.map((r, i) => {
        const s = stopRect(r);
        return `<div class="ov mon" style="${pos(r.x, MONITOR_Y, r.w, MONITOR_H)}"><span></span><button class="hb mb" data-mon="${i}"></button></div>
          <div class="rw" style="${pos(r.x, REEL_Y, r.w, REEL_H)}"><div class="strip">${SLOT}${SLOT}<button class="m" data-w="${i}"><span></span></button>${SLOT}</div></div>
          <div class="ov" style="${pos(s.x + 2, 144, s.w - 4, 13)}"><button class="hb sb" data-s="${i}"><span class="f"></span></button></div>`;
      }).join('') + `<div class="ov" style="${pos(COUNT_BTN.x, COUNT_BTN.plusY, COUNT_BTN.size, COUNT_BTN.size)}"><button class="hb rb up" id="rp" data-c="1" aria-label="リールを1つ増やす"><span class="cf plus"></span></button></div>
        <div class="ov" style="${pos(COUNT_BTN.x, COUNT_BTN.minusY, COUNT_BTN.size, COUNT_BTN.size)}"><button class="hb rb dn" id="rn" data-c="-1" aria-label="リールを1つ減らす"><span class="cf"></span></button></div>
        <div class="ov" style="${pos(80, 127, 40, 12)}"><button class="hb" id="idea" aria-label="このアイデアを当たりとして保存"></button></div>
        <div class="ov tk" style="${pos(71, 51, 58, 8)}"><span id="tks"></span></div>
        <div class="ov" style="${pos(178, 40, 20, 84)}"><button class="hb" id="lev" aria-label="レバーを引く"></button></div>`;
      mons = [...ov.querySelectorAll('.mon span')];
      wins = [...ov.querySelectorAll('.rw')];
      btns = [...ov.querySelectorAll('.sb')];
      ticker = ov.querySelector('#tks');
      plus = ov.querySelector('#rp');
      minus = ov.querySelector('#rn');
      menuEl = null;
      menuIndex = null;
      menuKind = null;
    },
    setWords(i, words) {
      wins[i].querySelectorAll('.strip span').forEach((el, k) => { el.textContent = words[k]; });
    },
    setMonitor(i, text, themed) {
      mons[i].textContent = text;
      mons[i].parentElement.classList.toggle('th', themed);
      mons[i].nextElementSibling.setAttribute('aria-label', `${i + 1}番リールの種類：${text}（押して変える）`);
    },
    // リール数の＋－: 回転中と限界では押せない
    setCount(n, editable) {
      plus.disabled = !editable || n >= 4;
      minus.disabled = !editable || n <= 2;
    },
    setState(i, { running, held }) {
      wins[i].classList.toggle('spin', running);
      if (running) wins[i].classList.remove('bn'); // 弾みのアニメが回転のアニメを上書きしないように
      wins[i].classList.toggle('lk', held && !running);
      btns[i].className = 'hb sb ' + (running ? 'on' : held ? 'lk1' : 'lk0');
      btns[i].firstChild.textContent = running ? 'STOP' : held ? 'LOCKED' : 'LOCK';
    },
    bounce(i) {
      wins[i].classList.remove('bn');
      void wins[i].offsetWidth;
      wins[i].classList.add('bn');
    },
    say(text) {
      ticker.textContent = text;
      ticker.style.animation = 'none';
      void ticker.offsetWidth;
      ticker.style.animation = '';
    },
    // 開いているメニューの番号。kind は 'w'（窓の語）か 't'（種類のリスト）。省略すると、どちらでも
    menuOpen: kind => (kind === undefined || kind === menuKind ? menuIndex : null),
    // mine: 自作テーマの名前の一覧（語を足す先）
    showMenu(i, { themed = false, themes = true, mine = [] } = {}) {
      openMenu(i, 'w', '<button data-m="x">この語を除外</button><button data-m="r">この枠だけ振り直す</button>'
        + (!themes ? '' : themed ? '<button data-m="u">テーマ解除</button>' : '<button data-m="t">この語をテーマに</button>')
        + (mine.length === 1 ? `<button data-m="a0">${esc('★' + mine[0] + 'に追加')}</button>` : mine.length ? '<button data-more>テーマに追加…</button>'
          + `<div class="sub" hidden><button data-up>← 戻る</button>${mine.map((n, k) => `<button data-m="a${k}">${esc('★' + n)}</button>`).join('')}</div>` : ''));
    },
    // 種類のチェック式リスト。items: {k, text, on} か {sep: true}。同じリールで開き直すとスクロールとフォーカスを保つ
    showTypes(i, items) {
      const prev = menuKind === 't' && menuIndex === i ? menuEl : null;
      const scroll = prev?.scrollTop ?? 0, focused = prev?.contains(document.activeElement) ? document.activeElement.dataset.ty : null;
      openMenu(i, 't', '<button data-pw>語をえらぶ…</button>' + items.map(x => (x.sep ? '<div class="sep"></div>'
        : `<button role="menuitemcheckbox" aria-checked="${x.on}" data-ty="${esc(x.k)}"><span class="cb${x.on ? ' on' : ''}"></span>${esc(x.text)}</button>`)).join(''));
      menuEl.scrollTop = scroll;
      if (focused !== null) [...menuEl.querySelectorAll('[data-ty]')].find(b => b.dataset.ty === focused)?.focus({ preventScroll: true });
    },
    hideMenu() {
      menuEl?.remove();
      menuEl = null;
      menuIndex = null;
      menuKind = null;
    },
  };

  // リールの真下にメニューを出す（右半分のリールは右に揃える）。種類のリストは画面の下に収まるよう高さを抑える
  function openMenu(i, kind, html) {
    view.hideMenu();
    const r = rects[i], side = r.x + r.w / 2 < 100 ? `left:${r.x / 2}%` : `right:${(200 - r.x - r.w) / 2}%`;
    let y = REEL_Y + REEL_H;
    menuEl = document.createElement('div');
    menuEl.className = 'wm' + (kind === 't' ? ' tl' : '');
    menuEl.innerHTML = html;
    ov.appendChild(menuEl);
    const wr = wrap.getBoundingClientRect(), at = yy => wr.top + wr.height * yy / 190;
    if (kind === 't' && innerHeight - at(y) < 300) y = MONITOR_Y + MONITOR_H; // 下に余裕がなければ、モニターの真下から窓に重ねて出す
    menuEl.style.maxHeight = Math.max(120, innerHeight - at(y) - 8) + 'px'; // どのメニューも画面の下に収め、長ければ中をスクロール
    menuEl.style.cssText += `;top:${y / 1.9}%;${side};min-width:${r.w / 2}%`;
    menuIndex = i;
    menuKind = kind;
  }

  ov.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (e.detail > 0) b.blur(); // マウス・タップのあとはキー操作（スペース等）を筐体に返す
    if (b.dataset.more !== undefined || b.dataset.up !== undefined) { // 「テーマに追加…」: メニューの中をテーマ名の一覧に切り替える（「← 戻る」で元に戻す）
      const sub = b.dataset.more !== undefined;
      [...menuEl.children].forEach(c => { c.hidden = c.classList.contains('sub') !== sub; });
      if (e.detail === 0) (sub ? menuEl.querySelector('.sub button') : menuEl.querySelector('[data-more]')).focus({ preventScroll: true }); // キー操作のときだけ（タップのあとはキーを筐体に返す）
      return;
    }
    if (b.dataset.s !== undefined) on.reel(+b.dataset.s);
    else if (b.dataset.w !== undefined) on.word(+b.dataset.w);
    else if (b.dataset.mon !== undefined) on.mon(+b.dataset.mon);
    else if (b.dataset.c !== undefined) on.count(+b.dataset.c);
    else if (b.dataset.ty !== undefined) on.type(b.dataset.ty, menuIndex);
    else if (b.dataset.pw !== undefined) { const i = menuIndex; view.hideMenu(); on.pickWord(i); }
    else if (b.dataset.m) { const i = menuIndex; view.hideMenu(); on.menu(b.dataset.m, i); }
    else if (b.id === 'idea') on.idea();
    else if (b.id === 'lev') on.lever();
  });
  document.addEventListener('click', (e) => { if (menuEl && !e.target.closest('.wm, .m, .mb')) view.hideMenu(); });
  return view;
}
