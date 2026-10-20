// 「このアプリについて」ダイアログ（中身は index.html にある）。ポーズの「画面」の項目か、使い方の最後のボタンから開く。
// ポーズから開いたときは、閉じるとポーズに戻る・外側を押すと閉じる（panels.js の data-open の仕組み）。使い方から開いたときは、使い方を開いたまま重ねるので、閉じると使い方に戻る。
export const HASHTAG = '#アイデアスロット'; // 感想・バグ報告のハッシュタグ。変えるのはここだけ

// 公開時の版。index.html が app.js を ?v=<版> で読み込み、そこから about.js も同じ版で読まれる（版が付かない開発中は null）
export const versionOf = url => new URL(url).searchParams.get('v');

export function initAbout() {
  const dlg = document.getElementById('about');
  const v = versionOf(import.meta.url);
  if (v) dlg.querySelector('#about-v').textContent = `（版 ${v}）`;
  dlg.querySelector('#about-tag').textContent = HASHTAG;
  document.querySelector('[data-open="about"]').onclick = () => { delete dlg.dataset.nb; dlg.showModal(); };
  document.getElementById('help-about').onclick = () => { dlg.dataset.nb = ''; dlg.showModal(); }; // nb: 閉じてもポーズには戻らない
  dlg.querySelector('[data-close]').onclick = () => dlg.close();
}
