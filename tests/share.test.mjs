import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeShare, decodeShare, shareUrl, codeFromHash, uniqueName, planImport, themePayload, templatePayload, linkInfo } from '../src/share.js';

const T = (name, words = ['a']) => ({ name, words });
const tpl = (name, ...types) => ({ name, slots: types.map(type => ({ type })) });

test('round trip: theme (names with | and %, long word list)', async () => {
  const p = { t: 'theme', themes: [T('a|b%c', Array.from({ length: 500 }, (_, i) => `語${i}`))] };
  const code = await encodeShare(p);
  assert.match(code, /^z1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeShare(code), p);
});
test('round trip: template with themes, mix types', async () => {
  const p = { t: 'tpl', template: tpl('朝', 'verb', 'mix:my:a%7Cb|animal'), themes: [T('a|b'), T('動物')] };
  assert.deepEqual(await decodeShare(await encodeShare(p)), p);
});
test('decode normalizes like the store (trim, dedupe words)', async () => {
  const p = await decodeShare(await encodeShare({ t: 'theme', themes: [{ name: ' 海 ', words: [' 魚', '魚', ''] }] }));
  assert.deepEqual(p, { t: 'theme', themes: [T('海', ['魚'])] });
});
test('decode: garbage and wrong shapes → null', async () => {
  const bad = ['', 'x', 'z1.', 'z1.!!!', 'z1.AAAA', 'j1.@@', 'q9.AAAA', null, undefined, 5, 'j1.' + 'A'.repeat(5)];
  for (const c of bad) assert.equal(await decodeShare(c), null, String(c));
  const j = o => 'j1.' + Buffer.from(JSON.stringify(o)).toString('base64url');
  for (const o of [
    {}, [], null, { t: 'theme' }, { t: 'theme', themes: [] }, { t: 'theme', themes: [{ name: '', words: [] }] },
    { t: 'theme', themes: [T('海'), T('海')] }, { t: 'theme', themes: Array.from({ length: 21 }, (_, i) => T('t' + i)) },
    { t: 'tpl', template: tpl('x', 'any'), themes: [] }, { t: 'tpl', themes: [] }, { t: 'tpl', template: tpl('x', 'any', 'any') },
    { t: 'other', themes: [T('a')] },
  ]) assert.equal(await decodeShare(j(o)), null, JSON.stringify(o));
  assert.deepEqual(await decodeShare(j({ t: 'tpl', template: tpl('x', 'any', 'verb'), themes: [] })), { t: 'tpl', template: tpl('x', 'any', 'verb'), themes: [] });
});
test('decode: rejects oversized JSON (also from a tiny compressed code)', async () => {
  const big = { t: 'theme', themes: [T('x', ['あ'.repeat(2 << 20)])] };
  assert.equal(await decodeShare(await encodeShare(big)), null);
});
test('shareUrl / codeFromHash', () => {
  assert.equal(shareUrl('https://x/y/', 'z1.abc'), 'https://x/y/#s=z1.abc');
  assert.equal(codeFromHash('#s=z1.abc'), 'z1.abc');
  assert.equal(codeFromHash('#a=1&s=j1.x'), 'j1.x');
  for (const h of ['', '#', '#s=', '#t=1']) assert.equal(codeFromHash(h), null);
});
test('uniqueName', () => {
  assert.equal(uniqueName('海', new Set()), '海');
  assert.equal(uniqueName('海', new Set(['海'])), '海（2）');
  assert.equal(uniqueName('海', new Set(['海', '海（2）', '海（3）'])), '海（4）');
});
test('themePayload / templatePayload pick only used user themes', () => {
  const mine = [T('海'), T('山'), T('空')];
  assert.deepEqual(themePayload(mine[0]), { t: 'theme', themes: [T('海')] });
  const p = templatePayload(tpl('旅', 'verb', 'my:山', 'mix:animal|my:空', 'my:消えた'), mine);
  assert.deepEqual(p.themes, [T('山'), T('空')]);
  assert.deepEqual(templatePayload(tpl('x', 'any', 'verb'), mine).themes, []);
});
test('planImport: theme renamed when taken, state untouched', () => {
  const state = { themes: [T('海'), T('海（2）')], templates: [] };
  const before = JSON.stringify(state);
  const r = planImport({ t: 'theme', themes: [T('海', ['x']), T('山')] }, state);
  assert.deepEqual(r, { themes: [T('海（3）', ['x']), T('山')], template: null, renamed: [{ from: '海', to: '海（3）' }] });
  assert.equal(JSON.stringify(state), before);
});
test('planImport: template slots follow renamed themes (single pass), template renamed', () => {
  const state = { themes: [T('海'), T('海（2）')], templates: [tpl('旅', 'any', 'any')] };
  const p = { t: 'tpl', template: tpl('旅', 'my:海', 'mix:my:海（2）|my:山|verb', 'any'), themes: [T('海'), T('海（2）'), T('山')] };
  const r = planImport(p, state);
  assert.deepEqual(r.themes.map(t => t.name), ['海（3）', '海（2）（2）', '山']);
  assert.deepEqual(r.template, tpl('旅（2）', 'my:海（3）', 'mix:my:海（2）（2）|my:山|verb', 'any'));
  assert.equal(r.renamed.length, 3);
});
test('linkInfo: copied note, long warning, manual fallback', async () => {
  const p = themePayload(T('海', ['x']));
  const ok = await linkInfo(p, async () => true, 'https://h/p');
  assert.match(ok.note, /^共有リンクをコピーしました（\d+文字）$/);
  assert.equal(ok.manual, '');
  const words = Array.from({ length: 3000 }, (_, i) => `w${i}-${Math.random()}`);
  const long = await linkInfo(themePayload(T('長', words)), async () => false, 'https://h/p');
  assert.match(long.note, /長いリンクです/);
  assert.match(long.manual, /^https:\/\/h\/p#s=z1\./);
});
