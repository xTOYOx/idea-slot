// X 用のデモ動画を、?demo の台本から作る。使い方: node tools/video.mjs [--promo] [--encode-only]
//   （なし）: out/idea-slot-demo.mp4  1920×1080（16:9）、台本そのまま
//   --promo : out/idea-slot-promo.mp4  1080×1080（正方形）、字幕・ブランドつき（tools/promo.html）
//   --encode-only: 撮り済みの out/*-frames から変換だけやり直す。--sec=N: 台本の頭から N 秒だけ作る（試し用）
// どちらも 30fps、H.264 + AAC（効果音）。
// 1) ページの時計を手で進める（tools/video-clock.js）。1/30 秒ずつ進めては 1 コマ PNG に撮る（マシンの重さでコマが落ちない）。鳴った効果音の時刻も記録する
// 2) tools/encode.html（WebCodecs + mp4-muxer）で、コマを H.264 に、記録した効果音を OfflineAudioContext で音にして AAC にし、mp4 に包む。mp4-muxer は jsDelivr から読むので通信が要る
// 3) 出来た mp4 を <video> で読み直し、確認用の静止画と一覧を書く。ffmpeg も npm も要らない。
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const promo = process.argv.includes('--promo');
const PORT = 8189, DEBUG = 9333, FPS = 30, DSF = 1.5, BITRATE = 12e6;
// モード別: page は撮る画面、view は CSS の大きさ（×DSF が動画の大きさ）、sec は撮る台本の秒、hold は最後の絵を置く秒、check は確認の静止画の秒
const M = promo
  ? { name: 'promo', page: '/tools/promo.html', view: [720, 720], sec: 28.5, hold: 0, check: [1, 3.5, 6, 9, 10, 12, 15, 18.6, 21.5, 24.5, 27.5], cols: 4 }
  : { name: 'demo', page: '/index.html?demo', view: [1280, 720], sec: 28.8, hold: 0.5, check: [1, 3.5, 6, 9, 10, 12, 15, 18.6, 21.5, 24.5, 27.5], cols: 4 };
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!CHROME) throw new Error('Chrome が見つかりません');
const root = resolve(import.meta.dirname, '..'), out = join(root, 'out'), frames = join(out, `${M.name}-frames`), checks = join(out, `${M.name}-check`), mp4 = join(out, `idea-slot-${M.name}.mp4`);
const sec = +process.argv.find(a => a.startsWith('--sec='))?.slice(6) || M.sec, check = M.check.filter(t => t < sec);
const base = `http://127.0.0.1:${PORT}`, sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = i => String(i + 1).padStart(5, '0');
if (!process.argv.includes('--encode-only')) rmSync(frames, { recursive: true, force: true }); // 前の撮影の残りを混ぜない
mkdirSync(frames, { recursive: true });
mkdirSync(checks, { recursive: true });

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

// 1) 撮影: 手で進める時計（video-clock.js）を差し込み、台本の 0 から 1/30 秒ずつ進めて撮る。返り値は { 撮ったコマ数, 効果音の記録 }
async function capture() {
  const c = await launch();
  try {
    const app = promo ? 'document.querySelector("iframe").contentWindow' : 'window'; // 台本を演じているページ
    await c.send('Page.enable');
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(join(root, 'tools/video-clock.js'), 'utf8') });
    await c.send('Emulation.setDeviceMetricsOverride', { width: M.view[0], height: M.view[1], deviceScaleFactor: DSF, mobile: false });
    await c.send('Page.navigate', { url: base + M.page });
    // 台本の 0（時計が止まる）まで待つ。読み込み画面（まだ薄く残る）は外す
    for (let i = 0; !(await c.run(`${app}.__vt?.on === true`).catch(() => false)); i++) {
      if (i > 200) throw new Error('デモが始まりません（読み込み失敗？）');
      await sleep(100);
    }
    await c.run(`${app}.document.getElementById("boot")?.remove(); document.fonts.ready.then(() => 1)`);
    const n = Math.round(sec * FPS);
    for (let i = 0; i < n; i++) {
      // 字幕（promo）を時刻に合わせてから、台本のページを進める
      await c.run(`(async () => { ${promo ? `await render(${i / FPS});` : ''} if (${i}) await ${app}.__vt.advance(${1000 / FPS}); })()`);
      const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(frames, `${pad(i)}.png`), Buffer.from(data, 'base64'));
      if (i % 60 === 0) console.log(`撮影 ${i + 1}/${n}（台本 ${(i / FPS).toFixed(1)} 秒）`);
    }
    // 鳴った効果音（app.js が window.__soundLog に [名前, performance.now()] で記録）を、台本の秒にして取る
    const sounds = JSON.parse(await c.run(`JSON.stringify((${app}.__soundLog ?? []).map(([name, t]) => [name, +((t - ${app}.__demoT0) / 1000).toFixed(4)]))`));
    writeFileSync(join(out, `${M.name}-sounds.json`), JSON.stringify(sounds));
    return { n, sounds };
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

// 2) 変換と 3) 確認: encode.html で mp4 にして受け取り、読み直して静止画と音を確かめる
async function encode({ n, sounds }) {
  const c = await launch();
  try {
    await c.send('Page.enable');
    await c.send('Page.navigate', { url: `${base}/tools/encode.html` });
    for (let i = 0; !(await c.run('window.ready === true')); i++) { if (i > 100) throw new Error('encode.html が準備できません'); await sleep(200); }
    const urls = Array.from({ length: n }, (_, i) => `/out/${M.name}-frames/${pad(i)}.png`), [w, h] = M.view.map(v => v * DSF), hold = sec < M.sec ? 0 : Math.round(M.hold * FPS);
    const len = await c.run(`encode(${JSON.stringify({ urls, hold, fps: FPS, w, h, bitrate: BITRATE, audio: { events: sounds } })})`);
    const parts = [], CH = 3 << 20;
    for (let p = 0; p < len; p += CH) parts.push(Buffer.from(await c.run(`(() => { const a = window.mp4.subarray(${p}, ${p + CH}); let s = ''; for (let k = 0; k < a.length; k += 8192) s += String.fromCharCode(...a.subarray(k, k + 8192)); return btoa(s); })()`), 'base64'));
    const buf = Buffer.concat(parts);
    writeFileSync(mp4, buf);
    const order = boxes(buf);
    console.log(`${mp4} (${(buf.length / 1048576).toFixed(1)} MB) ボックス順: ${order.join(' ')}`);
    if (order.indexOf('moov') > order.indexOf('mdat')) console.warn('警告: moov が mdat より後ろです');
    console.log(`音声トラック: ${buf.includes('mp4a') ? 'mp4a (AAC)' : '無し（警告）'}、効果音 ${sounds.length} 個:`, JSON.stringify(await c.run('audioInfo')));
    const url = `/out/idea-slot-${M.name}.mp4`;
    const [g, a] = [await c.run(`grab('${url}', ${JSON.stringify(check)}, ${M.cols})`), await c.run(`probeAudio('${url}')`)];
    g.shots.forEach((d, i) => writeFileSync(join(checks, `t${check[i]}.png`), Buffer.from(d.split(',')[1], 'base64')));
    writeFileSync(join(out, `${M.name}-contact.png`), Buffer.from(g.sheet.split(',')[1], 'base64'));
    console.log(`読み直し: ${g.w}×${g.h}、映像 ${g.duration.toFixed(2)} 秒、${n + hold} コマ、音 ${a.seconds.toFixed(2)} 秒 ${a.channels}ch 最大 ${a.peak.toFixed(3)}、確認画像 ${checks}、一覧 ${join(out, `${M.name}-contact.png`)}`);
  } finally { await c.close(); }
}

const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
try {
  for (let i = 0; ; i++) { // 配信が始まるのを待つ
    try { if ((await fetch(`${base}/index.html`)).ok) break; } catch { /* まだ */ }
    if (i > 50) throw new Error('python -m http.server が起動しません');
    await sleep(100);
  }
  await encode(process.argv.includes('--encode-only')
    ? { n: readdirSync(frames).length, sounds: JSON.parse(readFileSync(join(out, `${M.name}-sounds.json`), 'utf8')) } // 撮り済みを使う
    : await capture());
} finally {
  server.kill();
}
