// Service Worker。ページ本体はネット優先（オフラインならキャッシュ）、ほかのファイルはキャッシュ優先。
// 公開ファイルは ?v=<版> 付きで URL ごと変わるので、キャッシュ優先でも古いものを使い続けない。
// __VERSION__ は公開時（tools/publish.mjs → stampSw）に置き換わる。版が変わるとキャッシュ名も変わり、古いキャッシュは消える。
const NAME = 'idea-slot-__VERSION__';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('idea-slot-') && k !== NAME).map(k => caches.delete(k))))
    .then(() => self.clients.claim()),
));

const store = async (req, res) => {
  if (res.status === 200) (await caches.open(NAME)).put(req, res.clone());
  return res;
};

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(req.mode === 'navigate'
    ? fetch(req).then(res => store(req, res)).catch(async () => (await caches.match(req, { ignoreSearch: true })) ?? (await caches.match('./')) ?? Response.error())
    : caches.match(req).then(hit => hit ?? fetch(req).then(res => store(req, res))));
});

// 初めて開いたページは、まだ Service Worker の管理の外で読み込まれている。ページが読み込んだファイルの一覧を送ってくるので、まだ無いものだけ覚える
self.addEventListener('message', e => e.waitUntil((async () => {
  if (!Array.isArray(e.data)) return;
  const cache = await caches.open(NAME);
  await Promise.all(e.data.filter(u => typeof u === 'string' && u.startsWith(location.origin) && !u.endsWith('/sw.js')).map(async u => {
    if (!(await cache.match(u))) await cache.add(u).catch(() => {});
  }));
})()));
