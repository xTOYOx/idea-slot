// 筐体の上に重ねるHTML（モニター・リール窓・STOP/LOCKボタン・IDEA!・掲示板・レバー）。
// 座標は論理 W×190（W は 200〜340）から%で配置する。x は左に付く／右に付く（+ W-200）／伸びる／中央（W/2）のどれか（cabinet.js と同じ）。状態は持たず、app.js から言われたとおりに表示を変えるだけ。
import { reelRects, stopRect, MONITOR_Y, MONITOR_H, REEL_Y, REEL_H, COUNT_BTN } from './layout.js';

const SLOT = '<div class="e"><span></span></div>';

export function createOverlay(wrap, ov, on) {
  let W = 200, rects = [], wins = [], btns = [], mons = [], ticker = null, said = '', plus = null, minus = null;
  const pos = (x, y, w, h) => `left:${x / W * 100}%;top:${y / 1.9}%;width:${w / W * 100}%;height:${h / 1.9}%`;
  const fit = () => wrap.style.setProperty('--u', wrap.clientWidth / W + 'px');
  fit(); // 最初の描画から合わせる（ResizeObserver の通知を待たない）
  new ResizeObserver(fit).observe(wrap);

  const view = {
    // w: 筐体の論理幅。変わったときは呼び出し側が先に canvas と #wrap の幅を合わせておく
    build(n, w = 200) {
      W = w;
      fit();
      const D = W - 200, CX = W >> 1;
      rects = reelRects(n, W);
      ov.innerHTML = rects.map((r, i) => {
        const s = stopRect(r, W);
        return `<div class="ov mon" style="${pos(r.x, MONITOR_Y, r.w, MONITOR_H)}"><span></span><button class="hb mb" data-mon="${i}"></button></div>
          <div class="rw" style="${pos(r.x, REEL_Y, r.w, REEL_H)}"><div class="strip">${SLOT}${SLOT}<button class="m" data-w="${i}" title="クリックでコピー"><span></span></button>${SLOT}</div></div>
          <div class="ov" style="${pos(s.x + 2, 144, s.w - 4, 13)}"><button class="hb sb" data-s="${i}"><span class="f"></span></button></div>`;
      }).join('') + `<div class="ov" style="${pos(COUNT_BTN.x, COUNT_BTN.plusY, COUNT_BTN.size, COUNT_BTN.size)}"><button class="hb rb up" id="rp" data-c="1" aria-label="リールを1つ増やす"><span class="cf plus"></span></button></div>
        <div class="ov" style="${pos(COUNT_BTN.x, COUNT_BTN.minusY, COUNT_BTN.size, COUNT_BTN.size)}"><button class="hb rb dn" id="rn" data-c="-1" aria-label="リールを1つ減らす"><span class="cf"></span></button></div>
        <div class="ov" style="${pos(CX - 20, 127, 40, 12)}"><button class="hb" id="idea" aria-label="このアイデアを当たりとして保存"></button></div>
        <div class="ov tk" style="${pos(71, 51, 58 + D, 8)}"><span id="tks"></span></div>
        <div class="ov" style="${pos(178 + D, 40, 20, 84)}"><button class="hb" id="lev" aria-label="レバーを引く"></button></div>`;
      mons = [...ov.querySelectorAll('.mon span')];
      wins = [...ov.querySelectorAll('.rw')];
      btns = [...ov.querySelectorAll('.sb')];
      ticker = ov.querySelector('#tks');
      ticker.textContent = said; // 作り直しても掲示板の文は残す
      plus = ov.querySelector('#rp');
      minus = ov.querySelector('#rn');
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
    // 語をコピーしたとき、その窓を短く光らせる
    flash(i) {
      wins[i].classList.remove('cp');
      void wins[i].offsetWidth;
      wins[i].classList.add('cp');
    },
    bounce(i) {
      wins[i].classList.remove('bn');
      void wins[i].offsetWidth;
      wins[i].classList.add('bn');
    },
    say(text) {
      said = text;
      ticker.textContent = text;
      ticker.style.animation = 'none';
      void ticker.offsetWidth;
      ticker.style.animation = '';
    },
    focusMon: i => ov.querySelector(`[data-mon="${i}"]`)?.focus(),
  };

  ov.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (e.detail > 0) b.blur(); // マウス・タップのあとはキー操作（スペース等）を筐体に返す
    if (b.dataset.s !== undefined) on.reel(+b.dataset.s);
    else if (b.dataset.w !== undefined) on.word(+b.dataset.w);
    else if (b.dataset.mon !== undefined) on.mon(+b.dataset.mon);
    else if (b.dataset.c !== undefined) on.count(+b.dataset.c);
    else if (b.id === 'idea') on.idea();
    else if (b.id === 'lev') on.lever();
  });
  return view;
}
