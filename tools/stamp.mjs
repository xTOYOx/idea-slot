// 公開するファイルの参照に版番号 ?v=<版> を付ける（ブラウザが古い CSS・JS・データをキャッシュから使い続けないように）。
// 同じファイルはどこから参照しても同じ URL になるので、モジュールが二重に読まれることはない。

// index.html: style.css・src/app.js・manifest・タッチアイコン
export const stampHtml = (html, v) => html
  .replace(/(href=")(style\.css|manifest\.webmanifest|icons\/[\w.-]+\.png)(")/g, `$1$2?v=${v}$3`)
  .replace(/(src=")(src\/app\.js)(")/g, `$1$2?v=${v}$3`);

// style.css: フォントファイル
export const stampCss = (css, v) => css
  .replace(/(url\(['"]?)(fonts\/[\w.-]+)(['"]?\))/g, `$1$2?v=${v}$3`);

// sw.js: 版の目印 __VERSION__（キャッシュ名になる。中身が変わるので、ブラウザが新しい sw.js に入れ替える）
export const stampSw = (js, v) => js.replaceAll('__VERSION__', v);

// src/*.js: 相対パスの import と、data/*.json・data/defs/*.json の読み込み
export const stampJs = (js, v) => js
  .replace(/(from\s+['"])(\.\/[\w./-]+\.js)(['"])/g, `$1$2?v=${v}$3`)
  .replace(/(['"`])(data\/[\w${}./-]+\.json)(['"`])/g, `$1$2?v=${v}$3`);
