import { spin, rerollOne, resizeSlots } from './pick.js';

// 止まった直後にロックを誤操作しないための待ち時間
export const LOCK_GUARD_MS = 300;

const mapAt = (reels, i, f) => reels.map((r, j) => (j === i ? f(r) : { ...r }));

export const isSpinning = reels => reels.some(r => r.running);
export const allStopped = reels => !isSpinning(reels);
export const canEdit = allStopped;

export function startSpin(reels, pools, rng = Math.random) {
  if (isSpinning(reels)) return { ok: false, reason: 'spinning' };
  if (reels.every(r => r.held)) return { ok: false, reason: 'allLocked' };
  const next = spin(reels, pools, rng);
  return {
    ok: true,
    reels: reels.map((r, i) => (r.held ? { ...r } : { ...r, running: true, target: next[i].value })),
  };
}

export const stopReel = (reels, i, now) =>
  mapAt(reels, i, r => (r.running ? { ...r, value: r.target, running: false, stoppedAt: now } : { ...r }));


export function pressReel(reels, i, now) {
  const r = reels[i];
  if (r.running) return { reels: stopReel(reels, i, now), action: 'stop' };
  if (r.stoppedAt != null && now - r.stoppedAt < LOCK_GUARD_MS) return { reels: reels.map(x => ({ ...x })), action: 'ignored' };
  return { reels: mapAt(reels, i, x => ({ ...x, held: !x.held })), action: r.held ? 'unlock' : 'lock' };
}

export function canSave(reels, favorites) {
  if (isSpinning(reels)) return 'spinning';
  if (reels.some(r => !r.value)) return 'empty';
  const same = c => c.length === reels.length && c.every((w, i) => w === reels[i].value);
  return favorites.some(f => same(f.combo)) ? 'saved' : 'ok';
}

export const autoStopDelays = reels => reels.map((r, i) => (r.running ? 600 + 320 * i : null));

export const excludeAt = (reels, i, pools, rng = Math.random) =>
  rerollOne(mapAt(reels, i, r => ({ ...r, held: false })), i, pools, rng);

export const restore = (reels, combo) =>
  resizeSlots(reels, combo.length).map((r, i) => ({ ...r, value: combo[i], held: false, running: false, target: undefined, stoppedAt: undefined }));
