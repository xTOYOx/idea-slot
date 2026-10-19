import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexGraph, themeWords } from '../src/theme.js';
// 0 宇宙(同義:大宇宙) -memb-> 1 銀河 -hypo-> 2 渦巻銀河 -hypo-> 3 アンドロメダ -hypo-> 4 深い4 -hypo-> 5 深い5
// 1 銀河 -dom-> 6 天文学 ; 7 彗星 -dom-> 6 ; 7 -hypo-> 8 小彗星(分野の語からはたどらない)
// 9 自然物 -hypo-> 0 ; 9 -hypo-> 10 体(兄弟)
const graph = { v: 1,
  syn: [['宇宙', '大宇宙'], ['銀河'], ['渦巻銀河'], ['アンドロメダ'], ['深い4'], ['深い5'], ['天文学'], ['彗星'], ['小彗星'], ['自然物'], ['体']],
  hypo: [1, 2, 2, 3, 3, 4, 4, 5, 7, 8, 9, 0, 9, 10], part: [], memb: [0, 1], subs: [], inst: [], dom: [1, 6, 7, 6] };
const G = indexGraph(graph);

test('depth 3 with domain members, excluding start synonyms', () => {
  const w = themeWords(G, '宇宙', { min: 1 });
  assert.ok(w.includes('銀河') && w.includes('渦巻銀河') && w.includes('アンドロメダ'));
  assert.ok(w.includes('天文学') && w.includes('彗星'));
  assert.ok(!w.includes('小彗星'));          // 分野の語からはたどらない
  assert.ok(!w.includes('深い4'));            // D=3 で止まる
  assert.ok(!w.includes('宇宙') && !w.includes('大宇宙'));
  assert.ok(!w.includes('体'));               // 足りているので兄弟語なし
});
test('widens depth then adds siblings when below min', () => {
  const w = themeWords(G, '宇宙', { min: 100 });
  assert.ok(w.includes('深い4') && w.includes('深い5'));
  assert.ok(w.includes('体'));
});
test('excluded removed; unknown word gives []', () => {
  assert.ok(!themeWords(G, '宇宙', { min: 1, excluded: ['銀河'] }).includes('銀河'));
  assert.deepEqual(themeWords(G, '走る'), []);
});
test('domain members are not expanded', () => {
  assert.ok(!themeWords(G, '宇宙', { min: 100 }).includes('小彗星'));
});
test('no duplicates', () => {
  const w = themeWords(G, '宇宙', { min: 100 });
  assert.equal(new Set(w).size, w.length);
});
