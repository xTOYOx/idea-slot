// 効果音（Web Audio）。周波数と長さはモックアップ casino-v6.html の beep / sweep の呼び出しそのまま。
// AudioContext は最初の play で作る。作れない環境では何もしない。
// 各音は「どの AudioContext の、何秒から」でも組める（t）。動画の音声（tools/encode.html）は OfflineAudioContext で同じ音を組む。
function beep(a, t, f, d, ty = 'square', v = 0.05, o0 = 0) {
  const o = a.createOscillator(), g = a.createGain(), n = t + o0;
  o.type = ty; o.frequency.value = f;
  g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(0.0001, n + d);
  o.connect(g).connect(a.destination); o.start(n); o.stop(n + d);
}
function sweep(a, t, f1, f2, d, o0) {
  const o = a.createOscillator(), g = a.createGain(), n = t + o0;
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f1, n); o.frequency.linearRampToValueAtTime(f2, n + d);
  g.gain.setValueAtTime(0.035, n); g.gain.linearRampToValueAtTime(0, n + d);
  o.connect(g).connect(a.destination); o.start(n); o.stop(n + d);
}

export const SOUNDS = {
  lever: (a, t) => { beep(a, t, 90, 0.2, 'sawtooth', 0.07); [0, 0.05, 0.1].forEach((o) => beep(a, t, 600, 0.02, 'square', 0.03, o)); },
  tick: (a, t) => beep(a, t, 1500, 0.012, 'square', 0.02),
  stop: (a, t) => { beep(a, t, 196, 0.09, 'square', 0.08); beep(a, t, 392, 0.06, 'square', 0.05, 0.04); },
  lock: (a, t) => { beep(a, t, 880, 0.06); beep(a, t, 1320, 0.1, 'square', 0.05, 0.05); },
  unlock: (a, t) => { beep(a, t, 660, 0.06); beep(a, t, 440, 0.08, 'square', 0.05, 0.05); },
  chime: (a, t) => { beep(a, t, 659, 0.08, 'square', 0.04, 0.1); beep(a, t, 880, 0.12, 'square', 0.04, 0.18); },
  jackpot: (a, t) => {
    sweep(a, t, 500, 1300, 0.5, 0); sweep(a, t, 500, 1300, 0.5, 0.5);
    [523, 659, 784, 1047, 784, 1047].forEach((f, k) => beep(a, t, f, k === 5 ? 0.5 : 0.14, 'square', 0.05, 1 + k * 0.12));
    [0, 1, 2, 3, 4, 5].forEach((k) => beep(a, t, 2100 + k * 160, 0.05, 'square', 0.025, 1.8 + k * 0.08));
  },
  deny: (a, t) => beep(a, t, 150, 0.1, 'square', 0.04),
  coin: (a, t) => { beep(a, t, 1568, 0.04, 'square', 0.03); beep(a, t, 2093, 0.06, 'square', 0.025, 0.035); }, // 受け皿のコインを回収
};

export function createSound(onPlay) { // onPlay(name): 実際に鳴らした音の記録用（動画の撮影）
  let ac = null, failed = false;
  const ctx = () => {
    if (!ac && !failed) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { failed = true; }
    }
    return ac;
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
      onPlay?.(name);
      const a = ctx();
      if (!a) return;
      if (a.state === 'suspended') a.resume().catch(() => {});
      try { SOUNDS[name](a, a.currentTime); } catch { /* 音が鳴らないだけ */ }
    },
  };
  return sound;
}
