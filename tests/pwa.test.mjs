import test from 'node:test';
import assert from 'node:assert/strict';
import { wantsSw } from '../src/pwa.js';

const at = url => wantsSw(new URL(url));

test('wantsSw: https sites register, plain http and local hosts do not', () => {
  assert.equal(at('https://toyogame.github.io/idea-slot/'), true);
  assert.equal(at('http://example.com/'), false);
  assert.equal(at('http://localhost:8175/'), false);
  assert.equal(at('http://127.0.0.1:8175/'), false);
  assert.equal(at('https://localhost/'), false);
  assert.equal(at('http://[::1]:8175/'), false);
});
test('wantsSw: ?sw=1 registers anywhere (for checking locally)', () => {
  assert.equal(at('http://localhost:8175/?sw=1'), true);
  assert.equal(at('http://127.0.0.1:8175/?sw=1'), true);
  assert.equal(at('http://localhost:8175/?sw=0'), false);
  assert.equal(at('http://localhost:8175/?x=1&sw=1'), true);
});
