import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPE_KEYS, TYPE_LABELS } from '../src/types.js';
test('type keys order and labels', () => {
  assert.equal(TYPE_KEYS.length, 20);
  assert.deepEqual(TYPE_KEYS.slice(0, 3), ['any', 'noun', 'noun:animal']);
  assert.equal(TYPE_KEYS.at(-1), 'tag:mechanic');
  assert.equal(TYPE_LABELS['tag:look'], 'タグ：見た目');
});
