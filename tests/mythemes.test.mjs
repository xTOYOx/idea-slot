import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWords, addWords, removeWord, renameTheme, createTheme, deleteTheme } from '../src/mythemes.js';
const T = (name, words = []) => ({ name, words });

test('parseWords splits on newline / 、 / , / ，, trims, drops empty and duplicates in order', () => {
  assert.deepEqual(parseWords(' 犬、猫,鳥，犬\n\n 魚 \r\n猫'), ['犬', '猫', '鳥', '魚']);
  assert.deepEqual(parseWords('  \n 、, '), []);
  assert.deepEqual(parseWords(''), []);
});
test('addWords adds only new words, returns a new theme', () => {
  const t = T('海', ['魚']);
  const r = addWords(t, ['魚', '波', '波', '貝']);
  assert.deepEqual(r, { theme: T('海', ['魚', '波', '貝']), added: 2 });
  assert.deepEqual(t, T('海', ['魚']));
  assert.notEqual(r.theme, t);
  assert.equal(addWords(t, ['魚']).added, 0);
});
test('removeWord returns a new theme without the word', () => {
  const t = T('海', ['魚', '波']);
  assert.deepEqual(removeWord(t, '魚'), T('海', ['波']));
  assert.deepEqual(t.words, ['魚', '波']);
});
test('createTheme: appends; empty or duplicate → null; input untouched', () => {
  const l = [T('海')];
  assert.deepEqual(createTheme(l, '山'), [T('海'), T('山')]);
  assert.deepEqual(createTheme(l, ' 山 '), [T('海'), T('山')]);
  assert.equal(createTheme(l, ''), null);
  assert.equal(createTheme(l, '  '), null);
  assert.equal(createTheme(l, '海'), null);
  assert.deepEqual(l, [T('海')]);
});
test('renameTheme: keeps order and words; empty or duplicate → null; same name ok', () => {
  const l = [T('海', ['魚']), T('山')];
  assert.deepEqual(renameTheme(l, '海', '川'), [T('川', ['魚']), T('山')]);
  assert.equal(renameTheme(l, '海', ''), null);
  assert.equal(renameTheme(l, '海', '山'), null);
  assert.equal(renameTheme(l, '無', '川'), null);
  assert.deepEqual(renameTheme(l, '海', '海'), l);
  assert.deepEqual(l, [T('海', ['魚']), T('山')]);
});
test('deleteTheme removes by name without touching the input', () => {
  const l = [T('海'), T('山')];
  assert.deepEqual(deleteTheme(l, '海'), [T('山')]);
  assert.equal(l.length, 2);
});
