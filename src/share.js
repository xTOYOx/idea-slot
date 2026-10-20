// 共有リンク（DOM なし）。テーマ・テンプレートを JSON → 圧縮 → base64url にして URL の # に載せる（サーバーなし）。
// 形: { t: 'theme', themes: [{name, words}] } / { t: 'tpl', template: {name, slots}, themes: [...] }（themes はテンプレが使う自作テーマ）
import { cleanTheme } from './store.js';
import { cleanTemplate } from './templates.js';
import { parseType, buildType } from './typekey.js';
import { MY } from './types.js';

const MAX_THEMES = 20, MAX_JSON = 1 << 20; // 受け取る量の上限（展開後の JSON は約 1MB まで）
const URL_WARN = 8000; // これより長いリンクはアプリによって途中で切れる

const b64 = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = s => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('base64');
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); // atob は = が無くても読める
};
const pipe = (bytes, ts) => new Response(new Blob([bytes]).stream().pipeThrough(ts)).arrayBuffer().then(b => new Uint8Array(b));

// 展開は上限を超えたら打ち切る（小さな文字列から巨大なデータが出る圧縮爆弾を避ける）
async function inflate(bytes) {
  const r = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = [];
  let n = 0;
  for (let c = await r.read(); !c.done; c = await r.read()) {
    n += c.value.length;
    if (n > MAX_JSON) { r.cancel(); throw new Error('size'); }
    parts.push(c.value);
  }
  return new Blob(parts).text();
}

export async function encodeShare(payload) {
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  if (typeof CompressionStream === 'undefined') return 'j1.' + b64(raw);
  return 'z1.' + b64(await pipe(raw, new CompressionStream('deflate-raw')));
}

const uniq = list => new Set(list.map(x => x.name)).size === list.length;
const themesOf = v => {
  if (!Array.isArray(v) || v.length > MAX_THEMES) return null;
  const list = v.map(cleanTheme);
  return list.includes(null) || !uniq(list) ? null : list;
};

// 形が正しければ整えた payload、だめなら null
function validate(p) {
  if (p === null || typeof p !== 'object') return null;
  const themes = themesOf(p.themes);
  if (!themes) return null;
  if (p.t === 'theme') return themes.length ? { t: 'theme', themes } : null;
  const template = p.t === 'tpl' ? cleanTemplate(p.template) : null;
  return template ? { t: 'tpl', template, themes } : null;
}

export async function decodeShare(code) {
  try {
    if (typeof code !== 'string') return null;
    const kind = code.slice(0, 3), bytes = unb64(code.slice(3));
    if (kind === 'z1.') return validate(JSON.parse(await inflate(bytes)));
    if (kind === 'j1.' && bytes.length <= MAX_JSON) return validate(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch { /* 壊れたリンク */ }
  return null;
}

export const shareUrl = (base, code) => `${base}#s=${code}`;
export const codeFromHash = hash => new URLSearchParams(String(hash).replace(/^#/, '')).get('s') || null;

// 作ったリンクをコピーして、画面に出す文言を返す。コピーできなければ manual にリンクを入れる（手でコピーしてもらう）
export async function linkInfo(payload, copy, base = location.origin + location.pathname) {
  const url = shareUrl(base, await encodeShare(payload)), ok = await copy(url);
  const long = url.length > URL_WARN ? '長いリンクです。アプリによっては途中で切れることがあります' : '';
  return ok
    ? { note: `共有リンクをコピーしました（${url.length}文字）${long}`, manual: '' }
    : { note: `コピーできませんでした。下のリンクを手でコピーしてください${long}`, manual: url };
}

export const themePayload = theme => ({ t: 'theme', themes: [{ name: theme.name, words: theme.words }] });
// テンプレが使っている自作テーマ（無いものは付けない）も一緒に入れる
export function templatePayload(template, themes) {
  const used = new Set(template.slots.flatMap(s => parseType(s.type)).filter(k => k.startsWith(MY)).map(k => k.slice(MY.length)));
  return { t: 'tpl', template: { name: template.name, slots: template.slots.map(s => ({ type: s.type })) }, themes: themes.filter(t => used.has(t.name)).map(t => ({ name: t.name, words: t.words })) };
}

// 名前が taken に無ければそのまま、あれば「名前（2）」「名前（3）」…
export function uniqueName(name, taken) {
  let n = 1, s = name;
  while (taken.has(s)) s = `${name}（${++n}）`;
  return s;
}

// 追加したときの結果（state は変えない）。同じ名前は付け替え、テンプレの中の自作テーマも新しい名前に合わせる
export function planImport(payload, state) {
  const taken = new Set(state.themes.map(t => t.name)), map = new Map(), renamed = [];
  const themes = payload.themes.map(t => {
    const name = uniqueName(t.name, taken);
    taken.add(name);
    map.set(MY + t.name, MY + name);
    if (name !== t.name) renamed.push({ from: t.name, to: name });
    return { name, words: [...t.words] };
  });
  let template = null;
  if (payload.t === 'tpl') {
    const name = uniqueName(payload.template.name, new Set(state.templates.map(t => t.name)));
    if (name !== payload.template.name) renamed.push({ from: payload.template.name, to: name });
    // まとめて1回で付け替える（海→海（2）のあとに海（2）を別の名前へ、と重ねて変えないため）
    const slots = payload.template.slots.map(s => ({ type: buildType(parseType(s.type).map(k => map.get(k) ?? k)) }));
    template = { name, slots };
  }
  return { themes, template, renamed };
}
