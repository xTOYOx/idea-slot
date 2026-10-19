// ピクセルアート筐体の描画（論理 W×190。W は 200〜340、基準は 200）。見た目の基準は docs/superpowers/specs/mockups/casino-v6.html
// 描くだけで、入力処理もHTMLの重ね物も持たない（それはアプリ側）。
import { reelRects, stopRect, MONITOR_Y, MONITOR_H, REEL_Y, REEL_H, COUNT_BTN, W_MIN } from './layout.js';

// x 座標は三種類: 左に付く（そのまま）／右に付く（+ D、D = W - 200）／伸びる（幅に + D）／中央（CX 基準、CX = W/2）
const H = 190, DY = 10; // DY: LEDバーより下（元の y ≥ 61）をモニターの分だけ下げる量
const K = '#0b0610', R0 = '#3a0614', R1 = '#6b0f24', R2 = '#a3182f', R3 = '#e0303e';
const G0 = '#5c3a06', G1 = '#a8700c', G2 = '#e8b020', G3 = '#ffe066', G4 = '#fff7c2';
const C0 = '#2a2f3a', C1 = '#5d6577', C2 = '#9aa3b5', C3 = '#d8deea';
const RAINBOW = ['#ff3030', '#ffe066', '#3eff7a', '#3ef0ff', '#ff3ea5'];

const F = { I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'], E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'], ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'] };
const RM = [4, 3, 3, 2, 2, 1, 1];
const T = { C: '111100100100111', R: '110101110101101', E: '111100110100111', D: '110101101101110', I: '111010010010111', A: '010101111101101', S: '111100111001111', B: '110101110101110', O: '111101101101111', N: '101111111101101', U: '101101101101111', H: '101101111101101', T: '111010010010010', P: '110101110100100', V: '101101101101010', L: '100100100100111', '!': '010010010000010', 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111' };
const DOME = ['...RRRRRR...', '..RWRRRRRR..', '.RWRRRRRRRr.', '.RRRRRRRRRr.', 'RRRRRRRRRRrr', 'rrrrrrrrrrrr', 'CCCCCCCCCCCC'];
const BALL = ['...RRRR...', '..RWWRRR..', '.RWRRRRRr.', 'RWRRRRRRrr', 'RRRRRRRRrr', 'RRRRRRRrrr', 'RRRRRRrrrr', '.RRRrrrrr.', '..rrrrrr..', '...rrrr...'];
const COIN = [4, 3, 2, 1, 2, 3];

const CELEBRATE_MS = 3200, LEVER_MS = 220, PRESS_MS = 120;

export function createCabinet(canvas) {
  let W = W_MIN, D = 0, CX = 100;
  canvas.width = W;
  canvas.height = H;
  const C = canvas.getContext('2d');
  const st = document.createElement('canvas');
  st.width = W;
  st.height = H;
  const S = st.getContext('2d');
  let X = S;

  const px = (x, y, w, h, c) => { X.fillStyle = c; X.fillRect(x, y, w, h); };
  const box = (x, y, w, h, b, hi, lo) => {
    px(x, y, w, h, K); px(x + 1, y + 1, w - 2, h - 2, b);
    px(x + 1, y + 1, w - 2, 1, hi); px(x + 1, y + 1, 1, h - 2, hi);
    px(x + 1, y + h - 2, w - 2, 1, lo); px(x + w - 2, y + 1, 1, h - 2, lo);
  };
  const spr = (rows, x, y, pal) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]) px(x + i, y + j, 1, 1, pal[ch]); }));
  const big = (s, x, y, ramp, sw) => {
    const pts = [];
    [...s].forEach((ch, k) => F[ch].forEach((r, j) => [...r].forEach((b, i) => { if (b === '1') pts.push([x + k * 12 + i * 2, y + j * 2, j]); })));
    pts.forEach(([a, b]) => px(a + 1, b + 2, 2, 2, R0));
    pts.forEach(([a, b]) => px(a - 1, b - 1, 4, 4, K));
    pts.forEach(([a, b, j]) => px(a, b, 2, 2, Math.abs(a + b * 0.6 - sw) < 3 ? '#ffffff' : ramp[RM[j]]));
  };
  const tiny = (s, x, y, c) => [...s].forEach((ch, k) => [...T[ch]].forEach((b, n) => { if (b === '1') px(x + k * 4 + (n % 3), y + ((n / 3) | 0), 1, 1, c); }));
  const led = (n, d, x, y) => {
    tiny('8'.repeat(d), x, y, '#3a0808');
    tiny(String(Math.max(0, Math.min(9999, n | 0))).padStart(d, '0'), x, y, '#ff3030');
  };

  // 静的レイヤー（カーペットだけで36k回のfillRectなので、リール数が変わったときだけ描き直す）
  function drawStatic(n) {
    X = S;
    const rects = reelRects(n, W);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = (x + y) % 12, b = (x - y + 600) % 12;
        let c = '#2a0716';
        if (a === 0 || b === 0) c = '#4e1424';
        if (a === 0 && b === 0) c = '#c8902a';
        if (a === 6 && b === 6) c = '#1f6b6b';
        if ((a === 5 || a === 7) && b === 6) c = '#164848';
        px(x, y, 1, 1, c);
      }
    }
    px(16, 176 + DY, 168 + D, 4, '#12040a');
    box(20, 12, 160 + D, 166 + DY, R1, R2, R0);
    [20, 176 + D].forEach((a) => { px(a, 12, 1, 166 + DY, K); px(a + 1, 12, 1, 166 + DY, C2); px(a + 2, 12, 1, 166 + DY, C3); px(a + 3, 12, 1, 166 + DY, C1); });
    px(24, 12, 152 + D, 36, G2); px(24, 12, 152 + D, 1, G4); px(24, 47, 152 + D, 1, G0); px(28, 16, 144 + D, 28, K); px(29, 17, 142 + D, 26, '#160818');
    box(24, 50, 152 + D, 10, K, '#1a1a1a', K); px(26, 51, 42, 8, '#1c0404'); px(132 + D, 51, 42, 8, '#1c0404'); px(70, 51, 60 + D, 8, '#140800');
    tiny('IDEAS', 28, 53, '#ff9a20'); tiny('HITS', 138 + D, 53, '#ff9a20');
    // モニター枠（文字はHTML）。暗い緑の液晶の地に黒い縁
    rects.forEach(({ x, w }) => { px(x, MONITOR_Y, w, MONITOR_H, K); px(x + 1, MONITOR_Y + 1, w - 2, MONITOR_H - 2, '#0b2a18'); px(x + 1, MONITOR_Y + 1, w - 2, 1, '#10381f'); });
    box(26, 61 + DY, 148 + D, 67, C1, C3, C0); px(30, 68 + DY, 140 + D, 50, K);
    // 番号札: 窓の中央。左右の飾り線は札と窓の端の間に収まる分だけ
    rects.forEach(({ x, w }, i) => {
      const bx = x + Math.round((w - 10) / 2);
      box(bx, 62 + DY, 10, 6, '#1a1018', '#2a2030', '#0a0610');
      tiny(String(i + 1), bx + 4, 62 + DY, G3);
      const lw = bx - 3 - (x + 2), rx = bx + 13, rw = x + w - 2 - rx;
      if (lw > 0) { px(x + 2, 64 + DY, lw, 1, C0); px(x + 2, 65 + DY, lw, 1, C3); }
      if (rw > 0) { px(rx, 64 + DY, rw, 1, C0); px(rx, 65 + DY, rw, 1, C3); }
    });
    rects.forEach(({ x, w }) => {
      for (let r = 0; r < REEL_H; r++) {
        const e = Math.min(r, REEL_H - 1 - r);
        px(x, REEL_Y + r, w, 1, e < 2 ? '#5a4626' : e < 5 ? '#a8884c' : e < 9 ? '#e0cc98' : (r >= 16 && r < 32) ? '#fffbea' : '#fff2d0');
      }
    });
    [[27, 1], [172 + D, -1]].forEach(([x0, dir]) => [1, 2, 3, 3, 3, 2, 1].forEach((w, j) => px(dir > 0 ? x0 : x0 - w + 1, 90 + DY + j, w, 1, R3)));
    for (let i = 0; i + 1 < n; i++) px(rects[i].x + rects[i].w, 93 + DY, rects[i + 1].x - rects[i].x - rects[i].w, 1, '#ff3030');
    px(CX - 20, 118 + DY, 40, 10, C0);
    box(22, 129 + DY, 156 + D, 24, '#3a0a18', '#7a1a30', '#1a0408'); px(22, 129 + DY, 156 + D, 1, G3);
    rects.forEach((r) => { const s = stopRect(r, W); box(s.x, 132 + DY, s.w, 17, C1, C3, C0); });
    box(30, 154 + DY, 140 + D, 22, C1, C3, C0); px(33, 159 + DY, 134 + D, 14, '#14141c'); px(33, 159 + DY, 134 + D, 2, '#06060a');
    ['#c8202f', '#1f4fbf', '#108a4a', '#222222', '#c8202f', '#e8b020'].forEach((c, k) => {
      const y = 171 + DY - k * 4;
      px(3, y, 14, 4, K); px(4, y, 12, 3, c); [6, 10, 14].forEach((xx) => px(xx - 1, y, 1, 3, '#ffffff')); px(4, y, 12, 1, '#ffffff55');
    });
    [[186 + D, 168 + DY], [192 + D, 170 + DY]].forEach(([x, y]) => { px(x, y, 6, 6, K); px(x + 1, y + 1, 4, 4, G2); px(x + 2, y + 1, 2, 1, G4); });
    box(180 + D, 100 + DY, 10, 14, C1, C3, C0);
    // リール数ボタンの台座（＋と－の絵は HTML）
    [COUNT_BTN.plusY, COUNT_BTN.minusY].forEach((y) => box(COUNT_BTN.x, y, COUNT_BTN.size, COUNT_BTN.size, C1, C3, C0));
  }

  // 動的な状態
  let v = { spinning: false, canSave: 'empty', ideas: 0, hits: 0, reduceMotion: false };
  let t0 = performance.now(), celebrateUntil = 0, leverUntil = 0, pressUntil = 0;
  let parts = [];
  // 受け皿のコイン。x は皿の左端(35)からの距離 ox。W が変わったら皿の幅に合わせて詰め直す
  const pile = [];
  const coin = () => ({ ox: Math.random() * (128 + D) | 0, y: 161 + DY + (Math.random() * 9 | 0) });
  for (let i = 0; i < 18; i++) pile.push(coin());

  function bulbs(fr, rain) {
    const pos = [];
    for (let x = 27; x < 172 + D; x += 6) pos.push([x, 13]);
    for (let y = 19; y < 44; y += 6) pos.push([172 + D, y]);
    for (let x = 171 + D; x > 26; x -= 6) pos.push([x, 44]);
    for (let y = 43; y > 18; y -= 6) pos.push([25, y]);
    pos.forEach(([x, y], i) => {
      const q = ((i - fr) % 4 + 4) % 4, on = q === 0 || (q === 2 && rain);
      px(x, y, 3, 3, rain ? RAINBOW[(i + fr) % 5] : on ? G4 : '#7a4a10');
      if (on || rain) px(x, y, 1, 1, '#ffffff');
    });
    for (let y = 52; y < 174 + DY; y += 8) {
      const k = y / 8 | 0, on = ((k - fr) % 3 + 3) % 3 === 0;
      [21, 177 + D].forEach((x) => px(x, y, 2, 2, rain ? RAINBOW[(k + fr) % 5] : on ? G4 : '#6a4010'));
    }
  }

  function burst(n, x0, x1, y, vy) {
    for (let k = 0; k < n; k++) parts.push({ x: x0 + Math.random() * (x1 - x0), y, vx: (Math.random() - 0.5) * 2.4, vy: -(Math.random() * vy + 1), f: k });
  }

  let lastDraw = 0, wasBusy = false;
  function frame(t) {
    requestAnimationFrame(frame);
    // 動くものが無いときは間引く（点滅などは時刻から決めるので見た目は同じ）
    const busy = v.spinning || t < celebrateUntil || t < leverUntil || t < pressUntil || parts.length > 0;
    if (!busy && !wasBusy && t - lastDraw < (v.reduceMotion ? 250 : 100)) return;
    wasBusy = busy;
    lastDraw = t;
    const rm = v.reduceMotion, celebrating = t < celebrateUntil;
    const rain = celebrating && !rm; // 低減モードでは電球・回転灯・コインは動かさない
    const el = t - t0;
    const fr = rm ? 0 : Math.floor(el / (rain ? 50 : v.spinning ? 70 : 150));
    X = C;
    C.drawImage(st, 0, 0);
    bulbs(fr, rain);
    const sw = rm ? -99 : (el / 9) % 420 - 60;
    const RR = ['#3a0614', '#a3182f', '#e0303e', '#ff6a6a', '#ffd0d0'];
    big('7', 33, 23, RR, -99); big('7', 159 + D, 23, RR, -99); big('IDEA SLOT', CX - 54, 23, [G0, G1, G2, G3, G4], sw);
    spr(DOME, CX - 6, 3, { R: rain ? (fr % 2 ? '#ff3030' : '#ff7070') : '#7a1414', r: rain ? '#a01010' : '#4a0808', W: rain ? '#ffffff' : '#c06060', C: C2 });
    if (rain) {
      const L = fr % 2;
      for (let k = 1; k < 9; k++) { const xx = L ? CX - 8 - k * 3 : CX + 8 + k * 3; px(xx, 6 - (k >> 2), 2, 1, '#ffe066'); px(xx, 9 + (k >> 2), 2, 1, '#ffe06688'); }
    }
    led(v.ideas, 4, 51, 53); led(v.hits, 4, 155 + D, 53);

    // IDEA! ランプ
    const blink = rm ? 1 : Math.floor(el / 320) % 2, ly = 119 + DY + (t < pressUntil ? 1 : 0);
    if (celebrating) {
      box(CX - 18, ly, 36, 9, rm ? '#ffe066' : ['#ff3ea5', '#3ef0ff', '#ffe066', '#3eff7a'][fr % 4], '#ffffff', '#a01060'); tiny('IDEA!', CX - 10, ly + 2, '#ffffff');
    } else if (v.canSave === 'ok') {
      box(CX - 18, ly, 36, 9, blink ? '#ff3ea5' : '#a0105a', blink ? '#ffc0e0' : '#d04080', '#5a0030'); tiny(blink ? 'IDEA!' : 'PUSH!', CX - 10, ly + 2, '#ffffff');
      if (blink) { px(CX - 22, ly + 3, 2, 3, G3); px(CX + 20, ly + 3, 2, 3, G3); }
    } else if (v.canSave === 'saved') {
      box(CX - 18, ly, 36, 9, G1, G3, G0); tiny('SAVED', CX - 10, ly + 2, G4);
    } else {
      box(CX - 18, ly, 36, 9, '#1a1018', '#2a2030', '#0a0610'); tiny('IDEA!', CX - 10, ly + 2, '#3a3040');
    }

    // レバー
    const top = t < leverUntil ? 78 : 46;
    const stalk = 100 + DY - top - 8; // 棒の根元は台座（+DY）まで伸ばす。玉の上端は動かさない
    px(184 + D, top + 8, 3, stalk, C3); px(184 + D, top + 8, 1, stalk, '#ffffff'); px(186 + D, top + 8, 1, stalk, C1);
    spr(BALL, 180 + D, top, { R: '#ff3030', r: '#a01010', W: '#ffffff' });

    // 受け皿のコインと落ちてくる粒
    pile.forEach(({ ox, y }) => { const x = 35 + ox; px(x, y, 4, 3, G1); px(x, y, 4, 2, G2); px(x + 1, y, 2, 1, G4); });
    parts = parts.filter((p) => {
      p.vy += 0.18; p.x += p.vx; p.y += p.vy;
      if (p.y >= 168 + DY && p.vy > 0 && p.x > 34 && p.x < 162 + D) { if (pile.length < 90) pile.push({ ox: (p.x | 0) - 35, y: 161 + DY + (Math.random() * 9 | 0) }); return false; }
      if (p.y > 182 + DY) return false;
      const w = COIN[(p.f++ >> 1) % 6];
      px(p.x + (4 - w) / 2, p.y, w, 4, G2); px(p.x + (4 - w) / 2, p.y, Math.max(1, w - 1), 1, G4);
      return true;
    });
  }

  const cab = {
    // n: リール数。w: 論理幅（省略すると今のまま）。幅が変わったときだけ canvas を作り直す（代入すると中身が消える）
    setReels(n, w = W) {
      if (w !== W) {
        const k = (128 + w - W_MIN) / (128 + D);
        W = w; D = W - W_MIN; CX = W >> 1;
        pile.forEach(c => { c.ox = c.ox * k | 0; });
        while (pile.length < Math.round(18 * (128 + D) / 128)) pile.push(coin());
        canvas.width = st.width = W;
        parts = []; // 粒の位置は古い幅のもの
      }
      drawStatic(n);
    },
    update(view) { v = { ...v, ...view }; },
    pullLever() { leverUntil = performance.now() + LEVER_MS; },
    celebrate() {
      celebrateUntil = performance.now() + CELEBRATE_MS;
      if (!v.reduceMotion) burst(48, 40, 160 + D, 52, 3);
    },
    dribble() { if (!v.reduceMotion) burst(5, CX - 20, CX + 20, 158 + DY, 2.2); },
    pressIdea() { pressUntil = performance.now() + PRESS_MS; },
    celebrating() { return performance.now() < celebrateUntil; },
  };
  cab.setReels(3);
  requestAnimationFrame(frame);
  return cab;
}
