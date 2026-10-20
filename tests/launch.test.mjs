import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { versionOf, HASHTAG } from '../src/about.js';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('index.html');
const meta = (attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1];
const URL_BASE = 'https://toyogame.github.io/idea-slot/';

test('head: description and Open Graph / X card tags', () => {
  const desc = meta('name', 'description');
  assert.ok(desc && desc.length <= 120, 'description within 120 chars');
  assert.equal(meta('property', 'og:title'), meta('name', 'twitter:title'));
  assert.equal(meta('property', 'og:description'), desc);
  assert.equal(meta('name', 'twitter:description'), desc);
  assert.equal(meta('property', 'og:type'), 'website');
  assert.equal(meta('property', 'og:url'), URL_BASE);
  assert.equal(meta('property', 'og:locale'), 'ja_JP');
  assert.equal(meta('property', 'og:image'), URL_BASE + 'og.png'); // 絶対 URL・版の ?v= なし
  assert.equal(meta('name', 'twitter:image'), URL_BASE + 'og.png');
  assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
  assert.equal(meta('property', 'og:image:width'), '1200');
  assert.equal(meta('property', 'og:image:height'), '630');
});
test('manifest description matches the page description', () => {
  assert.equal(JSON.parse(read('manifest.webmanifest')).description, meta('name', 'description'));
});

test('og.png: a 1200x630 PNG under 1 MB', () => {
  assert.ok(existsSync(new URL('../og.png', import.meta.url)), 'run: node tools/og.mjs');
  const buf = readFileSync(new URL('../og.png', import.meta.url));
  assert.equal(buf.subarray(1, 4).toString(), 'PNG');
  assert.equal(buf.readUInt32BE(16), 1200);
  assert.equal(buf.readUInt32BE(20), 630);
  assert.ok(statSync(new URL('../og.png', import.meta.url)).size < 1024 * 1024);
});

test('publish.mjs ships og.png and the LICENSE, but not the card page (tools/)', () => {
  const files = read('tools/publish.mjs').match(/const FILES = \[([^\]]*)\]/)[1];
  assert.ok(files.includes("'og.png'") && files.includes("'LICENSE'"));
  assert.ok(!files.includes('tools'));
  assert.ok(existsSync(new URL('../LICENSE', import.meta.url)));
});
test('LICENSE: MIT, toyogame, 2026', () => {
  const t = read('LICENSE');
  assert.match(t, /^MIT License/);
  assert.match(t, /Copyright \(c\) 2026 toyogame/);
});

test('about: the version comes from the ?v= the page was loaded with (none while developing); the hashtag is one constant', () => {
  assert.equal(versionOf('https://toyogame.github.io/idea-slot/src/about.js?v=abc1234'), 'abc1234');
  assert.equal(versionOf('http://127.0.0.1:8187/src/about.js'), null);
  assert.match(HASHTAG, /^#\S+$/);
});
