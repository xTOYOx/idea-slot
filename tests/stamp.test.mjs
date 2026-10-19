import test from 'node:test';
import assert from 'node:assert/strict';
import { stampHtml, stampJs } from '../tools/stamp.mjs';

test('stampHtml: versions the stylesheet and the entry module only', () => {
  const html = '<link rel="stylesheet" href="style.css">\n<script type="module" src="src/app.js"></script>\n<a href="LICENSE-DATA.md">';
  assert.equal(stampHtml(html, 'abc123'),
    '<link rel="stylesheet" href="style.css?v=abc123">\n<script type="module" src="src/app.js?v=abc123"></script>\n<a href="LICENSE-DATA.md">');
});

test('stampJs: versions relative imports and data fetches, leaves the rest alone', () => {
  const js = [
    "import { a } from './types.js';",
    'import { b } from "./pools.js";',
    "fetch('data/graph.json', { x: 1 })",
    'fetch(`data/${n}.json`)',
    "fetch('data/extra.json')",
    "const s = 'from ./nothing';",
    "import(el) { el.click(); },",
  ].join('\n');
  assert.equal(stampJs(js, 'v1'), [
    "import { a } from './types.js?v=v1';",
    'import { b } from "./pools.js?v=v1";',
    "fetch('data/graph.json?v=v1', { x: 1 })",
    'fetch(`data/${n}.json?v=v1`)',
    "fetch('data/extra.json?v=v1')",
    "const s = 'from ./nothing';",
    "import(el) { el.click(); },",
  ].join('\n'));
});
