// 効果音（Web Audio）。周波数と長さはモックアップ casino-v6.html の beep / sweep の呼び出しそのまま。
// AudioContext は最初の play で作る。作れない環境では何もしない。
export function createSound() {
  let ac = null, failed = false;
  const ctx = () => {
    if (!ac && !failed) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { failed = true; }
    }
    return ac;
  };

  function beep(a, f, d, ty = 'square', v = 0.05, o0 = 0) {
    const o = a.createOscillator(), g = a.createGain(), n = a.currentTime + o0;
    o.type = ty; o.frequency.value = f;
    g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(0.0001, n + d);
    o.connect(g).connect(a.destination); o.start(n); o.stop(n + d);
  }
  function sweep(a, f1, f2, d, o0) {
    const o = a.createOscillator(), g = a.createGain(), n = a.currentTime + o0;
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f1, n); o.frequency.linearRampToValueAtTime(f2, n + d);
    g.gain.setValueAtTime(0.035, n); g.gain.linearRampToValueAtTime(0, n + d);
    o.connect(g).connect(a.destination); o.start(n); o.stop(n + d);
  }

  const SOUNDS = {
    lever: (a) => { beep(a, 90, 0.2, 'sawtooth', 0.07); [0, 0.05, 0.1].forEach((o) => beep(a, 600, 0.02, 'square', 0.03, o)); },
    tick: (a) => beep(a, 1500, 0.012, 'square', 0.02),
    stop: (a) => { beep(a, 196, 0.09, 'square', 0.08); beep(a, 392, 0.06, 'square', 0.05, 0.04); },
    lock: (a) => { beep(a, 880, 0.06); beep(a, 1320, 0.1, 'square', 0.05, 0.05); },
    unlock: (a) => { beep(a, 660, 0.06); beep(a, 440, 0.08, 'square', 0.05, 0.05); },
    chime: (a) => { beep(a, 659, 0.08, 'square', 0.04, 0.1); beep(a, 880, 0.12, 'square', 0.04, 0.18); },
    jackpot: (a) => {
      sweep(a, 500, 1300, 0.5, 0); sweep(a, 500, 1300, 0.5, 0.5);
      [523, 659, 784, 1047, 784, 1047].forEach((f, k) => beep(a, f, k === 5 ? 0.5 : 0.14, 'square', 0.05, 1 + k * 0.12));
      [0, 1, 2, 3, 4, 5].forEach((k) => beep(a, 2100 + k * 160, 0.05, 'square', 0.025, 1.8 + k * 0.08));
    },
    deny: (a) => beep(a, 150, 0.1, 'square', 0.04),
    coin: (a) => { beep(a, 1568, 0.04, 'square', 0.03); beep(a, 2093, 0.06, 'square', 0.025, 0.035); }, // 受け皿のコインを回収
  };
  // 連続して鳴りすぎないように（なぞると何度も呼ばれる）
  const GAP = { coin: 60 }, last = {};

  const sound = {
    enabled: true,
    play(name) {
      if (!sound.enabled || !SOUNDS[name]) return;
      const now = performance.now();
      if (now - (last[name] ?? -1e9) < (GAP[name] ?? 0)) return;
      last[name] = now;
      const a = ctx();
      if (!a) return;
      if (a.state === 'suspended') a.resume().catch(() => {});
      try { SOUNDS[name](a); } catch { /* 音が鳴らないだけ */ }
    },
  };
  return sound;
}
