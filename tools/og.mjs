// X のカード画像 og.png（1200×630）を、実際の画面から作る。使い方: node tools/og.mjs
// tools/og.html（本物の筐体 index.html?shot を iframe に入れた画面）を、ローカルの python -m http.server で配信し、Chrome の headless で撮る。
// ?shot は保存データを使わないので、Chrome のプロファイルは捨てる一時フォルダにする。npm の追加は要らない。
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PORT = 8188;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!CHROME) throw new Error('Chrome が見つかりません');
const root = resolve(import.meta.dirname, '..'), out = join(root, 'og.png');
const profile = mkdtempSync(join(tmpdir(), 'idea-slot-og-'));

const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
try {
  for (let i = 0; ; i++) { // 配信が始まるのを待つ
    try { if ((await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok) break; } catch { /* まだ */ }
    if (i > 50) throw new Error('python -m http.server が起動しません');
    await new Promise(r => setTimeout(r, 100));
  }
  // virtual-time-budget: データの読み込みと、当たりの演出（コインの噴き出し）が進むまで待ってから撮る
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--user-data-dir=${profile}`,
    '--window-size=1200,630', '--virtual-time-budget=1250', `--screenshot=${out}`, `http://127.0.0.1:${PORT}/tools/og.html`], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`Chrome が失敗しました (${r.status})`);
  console.log(`${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`);
} finally {
  server.kill();
  rmSync(profile, { recursive: true, force: true });
}
