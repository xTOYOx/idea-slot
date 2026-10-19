import test from 'node:test';
import assert from 'node:assert/strict';
import { holePath, unionRect } from '../src/tour.js';

test('holePath: the whole screen with one hole per rect (even-odd)', () => {
  assert.equal(holePath([], 100, 50), "path(evenodd, 'M0 0H100V50H0Z')");
  assert.equal(holePath([{ left: 10, top: 5, right: 30, bottom: 20 }, { left: 60, top: 5, right: 90, bottom: 20 }], 100, 50),
    "path(evenodd, 'M0 0H100V50H0Z M10 5H30V20H10Z M60 5H90V20H60Z')");
});

test('unionRect: the smallest box around all rects', () => {
  assert.deepEqual(unionRect([{ left: 10, top: 20, right: 30, bottom: 40 }, { left: 5, top: 25, right: 50, bottom: 35 }]), { left: 5, top: 20, right: 50, bottom: 40 });
  assert.deepEqual(unionRect([{ left: 1, top: 2, right: 3, bottom: 4 }]), { left: 1, top: 2, right: 3, bottom: 4 });
});
