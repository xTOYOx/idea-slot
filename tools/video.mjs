// X 用のデモ動画 out/idea-slot-demo.mp4（1920×1080、30fps、H.264）を、?demo の台本から作る。使い方: node tools/video.mjs（撮り直さず変換だけなら --encode-only）
// 1) ページの時計を手で進める（tools/video-clock.js）。1/30 秒ずつ進めては 1 コマ PNG に撮る（マシンの重さでコマが落ちない）
// 2) tools/encode.html（WebCodecs + mp4-muxer）で H.264 にして mp4 に包む。mp4-muxer は jsDelivr から読むので通信が要る
// 3) 出来た mp4 を <video> で読み直し、out/check/ に確認用の静止画を書く。ffmpeg も npm も要らない。
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PORT = 8189, DEBUG = 9333, FPS = 30, W = 1280, H = 720, DSF = 1.5;
const END_MS = 11300, HOLD = 15, BITRATE = 12e6; // 台本の 0〜11.3 秒を撮り、最後の絵を 0.5 秒置く
const CHECK_AT = [0.5, 2, 3, 5, 6.2, 7, 9, 10.8];
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!CHROME) throw new Error('Chrome が見つかりません');
const root = resolve(import.meta.dirname, '..'), out = join(root, 'out'), frames = join(out, 'frames'), mp4 = join(out, 'idea-slot-demo.mp4');
const base = `http://127.0.0.1:${PORT}`, sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(frames, { recursive: true });
mkdirSync(join(out, 'check'), { recursive: true });

// Chrome を捨てプロファイルで起動し、ページに繋ぐ。send(method, params) と once(event)
async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'idea-slot-video-'));
  const proc = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  for (let i = 0; !ws; i++) {
    if (i > 100) throw new Error('Chrome に繋がりません');
    try { ws = new WebSocket((await (await fetch(`http://127.0.0.1:${DEBUG}/json`)).json()).find(t => t.type === 'page').webSocketDebuggerUrl); } catch { await sleep(100); }
  }
  await new Promise((ok, ng) => { ws.onopen = ok; ws.onerror = ng; });
  let id = 0;
  const calls = new Map(), waits = new Map();
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) { const [ok, ng] = calls.get(m.id); calls.delete(m.id); m.error ? ng(new Error(`${m.error.message}`)) : ok(m.result); }
    else waits.get(m.method)?.splice(0).forEach(f => f(m.params));
  };
  const once = ev => new Promise(ok => waits.set(ev, [...(waits.get(ev) ?? []), ok]));
  const send = (method, params = {}) => new Promise((ok, ng) => { calls.set(++id, [ok, ng]); ws.send(JSON.stringify({ id, method, params })); });
  const run = async expression => { // 式を評価して値を返す（Promise も待つ）
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const close = async () => { // Chrome が終わってから、プロファイルを消す（消せなくても続行）
    try { ws.close(); } catch { /* 閉じ済み */ }
    if (proc.exitCode === null) { const gone = new Promise(r => proc.once('exit', r)); proc.kill(); await gone; }
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* 次回の一時フォルダ掃除に任せる */ }
  };
  return { send, once, run, close };
}

// 1) 撮影: 手で進める時計（video-clock.js）を差し込み、台本の 0 から 1/30 秒ずつ進めて撮る
async function capture() {
  const c = await launch();
  try {
    await c.send('Page.enable');
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(join(root, 'tools/video-clock.js'), 'utf8') });
    await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DSF, mobile: false });
    await c.send('Page.navigate', { url: `${base}/index.html?demo` });
    // 台本の 0（時計が止まる）まで待つ。読み込み画面（まだ薄く残る）は外す
    for (let i = 0; !(await c.run('window.__vt?.on === true')); i++) {
      if (i > 200) throw new Error('デモが始まりません（読み込み失敗？）');
      await sleep(100);
    }
    await c.run('document.getElementById("boot")?.remove(); document.fonts.ready.then(() => __vt.advance(0))');
    const n = Math.round(END_MS * FPS / 1000);
    for (let i = 0; i < n; i++) {
      if (i) await c.run(`__vt.advance(${1000 / FPS})`);
      const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(frames, `${String(i + 1).padStart(5, '0')}.png`), Buffer.from(data, 'base64'));
      if (i % 30 === 0) console.log(`撮影 ${i + 1}/${n}（台本 ${(i / FPS).toFixed(1)} 秒）`);
    }
    return n;
  } finally { await c.close(); }
}

// moov が mdat より前にあるか（faststart）を、先頭のボックスを読んで確かめる
function boxes(buf) {
  const list = [];
  for (let p = 0; p + 8 <= buf.length;) {
    const size = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8);
    list.push(type);
    if (size < 8) break;
    p += size;
  }
  return list;
}

// 2) 変換と 3) 確認: encode.html で mp4 にして受け取り、読み直して静止画を撮る
async function encode(n) {
  const c = await launch();
  try {
    await c.send('Page.enable');
    await c.send('Page.navigate', { url: `${base}/tools/encode.html` });
    for (let i = 0; !(await c.run('window.ready === true')); i++) { if (i > 100) throw new Error('encode.html が準備できません'); await sleep(200); }
    const urls = Array.from({ length: n }, (_, i) => `/out/frames/${String(i + 1).padStart(5, '0')}.png`);
    const len = await c.run(`encode(${JSON.stringify({ urls, hold: HOLD, fps: FPS, w: W * DSF, h: H * DSF, bitrate: BITRATE })})`);
    const parts = [], CH = 3 << 20;
    for (let p = 0; p < len; p += CH) parts.push(Buffer.from(await c.run(`(() => { const a = window.mp4.subarray(${p}, ${p + CH}); let s = ''; for (let k = 0; k < a.length; k += 8192) s += String.fromCharCode(...a.subarray(k, k + 8192)); return btoa(s); })()`), 'base64'));
    const buf = Buffer.concat(parts);
    writeFileSync(mp4, buf);
    const order = boxes(buf);
    console.log(`${mp4} (${(buf.length / 1048576).toFixed(1)} MB) ボックス順: ${order.join(' ')}`);
    if (order.indexOf('moov') > order.indexOf('mdat')) console.warn('警告: moov が mdat より後ろです');
    const g = await c.run(`grab('/out/idea-slot-demo.mp4', ${JSON.stringify(CHECK_AT)})`);
    g.shots.forEach((d, i) => writeFileSync(join(out, 'check', `t${CHECK_AT[i]}.png`), Buffer.from(d.split(',')[1], 'base64')));
    console.log(`読み直し: ${g.w}×${g.h}、${g.duration.toFixed(2)} 秒、${n + HOLD} コマ、確認画像 ${join(out, 'check')}`);
  } finally { await c.close(); }
}

const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
try {
  for (let i = 0; ; i++) { // 配信が始まるのを待つ
    try { if ((await fetch(`${base}/index.html`)).ok) break; } catch { /* まだ */ }
    if (i > 50) throw new Error('python -m http.server が起動しません');
    await sleep(100);
  }
  await encode(process.argv.includes('--encode-only') ? readdirSync(frames).length : await capture()); // --encode-only: 撮り済みの out/frames を使う
} finally {
  server.kill();
}
