// 公開用リポジトリ（別アカウント）へ、サイトに必要なファイルだけを送る。
// 使い方: node tools/publish.mjs   （gh に公開用アカウントでログイン済みであること）
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ACCOUNT = 'toyogame';
const REPO = `${ACCOUNT}/idea-slot`;
const FILES = ['index.html', 'style.css', 'src', 'data', 'fonts', 'LICENSE-DATA.md', '.nojekyll'];
const GH = existsSync('C:/Program Files/GitHub CLI/gh.exe') ? 'C:/Program Files/GitHub CLI/gh.exe' : 'gh';

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...opts }).trim();
const token = run(GH, ['auth', 'token', '--user', ACCOUNT]);
const { id } = JSON.parse(run(GH, ['api', 'user'], { env: { ...process.env, GH_TOKEN: token } }));
const auth = ['-c', `http.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`];
const source = run('git', ['rev-parse', '--short', 'HEAD']);
if (run('git', ['status', '--porcelain', '--', ...FILES])) throw new Error('サイトのファイルに未コミットの変更があります。先にコミットしてください');

const dir = mkdtempSync(join(tmpdir(), 'idea-slot-publish-'));
const git = args => run('git', [...auth, '-C', dir, ...args]);
try {
  run('git', [...auth, 'clone', '-q', `https://github.com/${REPO}.git`, dir]);
  git(['checkout', '-q', '-B', 'main']);
  for (const f of readdirSync(dir)) if (f !== '.git') rmSync(join(dir, f), { recursive: true, force: true });
  for (const f of FILES) cpSync(f, join(dir, f), { recursive: true });
  writeFileSync(join(dir, 'README.md'),
    `# アイデアスロット\n\nゲーム企画のアイデア出しに使うスロットです。\n\nhttps://${ACCOUNT}.github.io/idea-slot/\n\n語データの出典は LICENSE-DATA.md、フォントは fonts/OFL.txt を参照してください。\n`);
  git(['add', '-A']);
  if (!git(['status', '--porcelain'])) {
    console.log('変更なし。公開済みの内容と同じです');
  } else {
    git(['-c', `user.name=${ACCOUNT}`, '-c', `user.email=${id}+${ACCOUNT}@users.noreply.github.com`, 'commit', '-q', '-m', `Publish ${source}`]);
    git(['push', '-q', 'origin', 'main']);
    console.log(`公開しました: ${source} → https://github.com/${REPO}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
