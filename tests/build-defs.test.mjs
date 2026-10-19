import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseDefs } from '../tools/build-defs.mjs';

const row = (lemma, def, freq = null, rank = '0') => ({ lemma, def, freq, rank });

test('chooseDefs: the larger freq wins, then the smaller rank; the first one wins a tie', () => {
  const m = chooseDefs([
    row('犬', 'a', null, '0'), row('犬', 'b', 3, '2'), row('犬', 'c', 3, '1'), row('犬', 'd', 1, '0'),
    row('猫', 'x', null, '2'), row('猫', 'y', null, '1'), row('鳥', 'p'), row('鳥', 'q'),
  ], new Set(['犬', '猫', '鳥']));
  assert.equal(m.get('犬'), 'c');
  assert.equal(m.get('猫'), 'y');
  assert.equal(m.get('鳥'), 'p');
});
test('chooseDefs: underscores in a lemma are dropped like in words.json; other words are skipped', () => {
  const m = chooseDefs([row('お_玉_杓子', 'おたまじゃくし'), row('知らない', 'zzz')], new Set(['お玉杓子']));
  assert.deepEqual([...m], [['お玉杓子', 'おたまじゃくし']]);
});
test('chooseDefs: blank meanings are ignored and the text is trimmed', () => {
  const m = chooseDefs([row('犬', '  '), row('犬', ' いぬ ', 0, '5')], new Set(['犬']));
  assert.equal(m.get('犬'), 'いぬ');
  assert.equal(chooseDefs([row('猫', '')], new Set(['猫'])).has('猫'), false);
});
