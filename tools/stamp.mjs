// 公開するファイルの参照に版番号 ?v=<版> を付ける（ブラウザが古い CSS・JS・データをキャッシュから使い続けないように）。
// 同じファイルはどこから参照しても同じ URL になるので、モジュールが二重に読まれることはない。

// index.html: style.css と src/app.js
export const stampHtml = (html, v) => html
  .replace(/(href=")(style\.css)(")/g, `$1$2?v=${v}$3`)
  .replace(/(src=")(src\/app\.js)(")/g, `$1$2?v=${v}$3`);

// src/*.js: 相対パスの import と、data/*.json・data/defs/*.json の読み込み
export const stampJs = (js, v) => js
  .replace(/(from\s+['"])(\.\/[\w./-]+\.js)(['"])/g, `$1$2?v=${v}$3`)
  .replace(/(['"`])(data\/[\w${}./-]+\.json)(['"`])/g, `$1$2?v=${v}$3`);
