// Service Worker の登録。https のときだけ。localhost・127.0.0.1 では登録しない（開発で古いキャッシュに悩まないため）。ただし ?sw=1 が付いていれば登録する（確認用）
export const wantsSw = loc => {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(loc.hostname);
  return (loc.protocol === 'https:' && !local) || new URLSearchParams(loc.search).get('sw') === '1';
};

export async function registerSw() {
  if (!('serviceWorker' in navigator) || !wantsSw(location)) return;
  try {
    await navigator.serviceWorker.register('sw.js');
    const { active } = await navigator.serviceWorker.ready;
    // 最初に開いたときに読み込んだファイルも、次からオフラインで使えるように覚えてもらう
    active?.postMessage([location.href, ...performance.getEntriesByType('resource').map(r => r.name)]);
  } catch { /* 登録できなくてもアプリは普通に動く */ }
}
