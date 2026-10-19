import test from 'node:test';
import assert from 'node:assert/strict';
import { stampHtml, stampJs, stampCss, stampSw } from '../tools/stamp.mjs';

test('stampHtml: versions the stylesheet and the entry module only', () => {
  const html = '<link rel="stylesheet" href="style.css">\n<script type="module" src="src/app.js"></script>\n<a href="LICENSE-DATA.md">';
  assert.equal(stampHtml(html, 'abc123'),
    '<link rel="stylesheet" href="style.css?v=abc123">\n<script type="module" src="src/app.js?v=abc123"></script>\n<a href="LICENSE-DATA.md">');
});

test('stampHtml: versions the manifest and the touch icon too', () => {
  const html = '<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n<link rel="stylesheet" href="style.css">';
  assert.equal(stampHtml(html, 'abc'),
    '<link rel="manifest" href="manifest.webmanifest?v=abc">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png?v=abc">\n<link rel="stylesheet" href="style.css?v=abc">');
});

test('stampCss: versions the font files, leaves other urls alone', () => {
  const css = "@font-face { src: url('fonts/a.woff2') format('woff2'), url('fonts/a.ttf'); }\nx { background: url(data:image/png;base64,AA) }";
  assert.equal(stampCss(css, 'v1'),
    "@font-face { src: url('fonts/a.woff2?v=v1') format('woff2'), url('fonts/a.ttf?v=v1'); }\nx { background: url(data:image/png;base64,AA) }");
});

test('stampSw: puts the version where the marker is (every occurrence)', () => {
  const js = "const V = '__VERSION__';\nconst name = `idea-slot-${V}`; // __VERSION__";
  assert.equal(stampSw(js, 'abc123'), "const V = 'abc123';\nconst name = `idea-slot-${V}`; // abc123");
  assert.equal(stampSw('no marker', 'abc'), 'no marker');
});

test('stampJs: versions relative imports and data fetches, leaves the rest alone', () => {
  const js = [
    "import { a } from './types.js';",
    'import { b } from "./pools.js";',
    "fetch('data/graph.json', { x: 1 })",
    'fetch(`data/${n}.json`)',
    "fetch('data/extra.json')",
    'fetch(`data/defs/${n}.json`)',
    "const s = 'from ./nothing';",
    "import(el) { el.click(); },",
  ].join('\n');
  assert.equal(stampJs(js, 'v1'), [
    "import { a } from './types.js?v=v1';",
    'import { b } from "./pools.js?v=v1";',
    "fetch('data/graph.json?v=v1', { x: 1 })",
    'fetch(`data/${n}.json?v=v1`)',
    "fetch('data/extra.json?v=v1')",
    'fetch(`data/defs/${n}.json?v=v1`)',
    "const s = 'from ./nothing';",
    "import(el) { el.click(); },",
  ].join('\n'));
});
