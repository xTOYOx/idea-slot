// tools/video.mjs がページの読み込み前に差し込む「手で進める時計」。公開物には入れない。
// 台本の 0（app.js が window.__demoT0 を置く瞬間）までは普通に動き、そこから時間が止まる。
// 以後は __vt.advance(ms) を呼んだぶんだけ、performance.now / Date.now / setTimeout / setInterval / rAF / CSS アニメーションが進む。
// （Chrome の仮想時間は、rAF が実時間で動いてコマが揃わないので使わない）
(() => {
  const N = Object.fromEntries(Object.entries({ st: setTimeout, ct: clearTimeout, si: setInterval, raf: requestAnimationFrame, caf: cancelAnimationFrame, now: performance.now.bind(performance) }).map(([k, f]) => [k, f.bind(window)]));
  N.date = Date.now();
  const off = N.date - N.now(), STEP = 1000 / 60, EPS = 1e-6;
  const timers = new Map(), rafs = new Map(), seen = new WeakMap(); // id → {fn, args, due, every, h}
  let virt = false, T = 0, T0 = 0, seq = 0, nextFrame = 0;
  const cur = () => (virt ? T : N.now());

  performance.now = cur;
  Date.now = () => off + cur();
  window.setTimeout = (fn, d = 0, ...args) => {
    const id = ++seq, e = { fn, args, due: cur() + Math.max(0, d) };
    timers.set(id, e);
    if (!virt) e.h = N.st(() => { timers.delete(id); fn(...args); }, d);
    return id;
  };
  window.setInterval = (fn, d = 0, ...args) => {
    const id = ++seq, e = { fn, args, every: Math.max(1, d), due: cur() + Math.max(1, d) };
    timers.set(id, e);
    if (!virt) e.h = N.si(() => fn(...args), d);
    return id;
  };
  window.clearTimeout = window.clearInterval = id => { N.ct(timers.get(id)?.h); timers.delete(id); };
  window.requestAnimationFrame = fn => {
    const id = ++seq, e = { fn };
    rafs.set(id, e);
    if (!virt) e.h = N.raf(ts => { rafs.delete(id); fn(ts); });
    return id;
  };
  window.cancelAnimationFrame = id => { N.caf(rafs.get(id)?.h); rafs.delete(id); };

  // 台本の 0 になった: 実時間のタイマーを全部こちらの待ち行列に移して、時間を止める
  const freeze = () => {
    T = T0 = N.now(); virt = true; nextFrame = T + STEP;
    for (const e of timers.values()) { N.ct(e.h); if (e.every) e.due = T + e.every; else e.due = Math.max(T, e.due); }
    for (const e of rafs.values()) N.caf(e.h);
  };
  Object.defineProperty(window, '__demoT0', { configurable: true, get: () => T0, set: freeze });

  // 走っている CSS アニメーション/トランジションも止めて、こちらの時間に合わせる
  const syncAnims = () => {
    for (const a of document.getAnimations()) {
      if (a.playState === 'finished') continue;
      if (!seen.has(a)) { seen.set(a, T - (a.currentTime ?? 0)); a.pause(); }
      const t = T - seen.get(a);
      if (t >= a.effect.getComputedTiming().endTime) a.finish(); else a.currentTime = t;
    }
  };
  const ch = new MessageChannel(), tick = () => new Promise(r => { ch.port1.onmessage = r; ch.port2.postMessage(0); }); // 1 回分の間（Promise の続きなどを流す）

  // ms だけ時間を進める。タイマーと rAF（60Hz）を、時刻の順に 1 つずつ実行する
  window.__vt = {
    get on() { return virt; },
    async advance(ms) {
      const end = T + ms;
      for (;;) {
        let id = null, due = Infinity;
        for (const [k, e] of timers) if (e.due < due) { id = k; due = e.due; }
        const isTimer = due <= nextFrame + EPS, at = isTimer ? due : nextFrame;
        if (at > end + EPS) break;
        T = Math.max(T, at);
        if (isTimer) {
          const e = timers.get(id);
          if (e.every) e.due += e.every; else timers.delete(id);
          e.fn(...e.args);
        } else {
          nextFrame += STEP;
          const q = [...rafs]; rafs.clear();
          for (const [, e] of q) e.fn(T);
        }
        syncAnims();
        await tick();
      }
      T = end;
      syncAnims();
    },
  };
})();
