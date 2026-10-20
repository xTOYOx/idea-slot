// 起動時の読み込み画面（#boot）。HTML と CSS だけで最初から出ていて、ここは進み具合の表示と消す処理だけ。
// step(): ファイルを1つ読み終えた。hide(now): 消す（now = true ならすぐ。演出を減らす設定のとき・読み込みに失敗したとき）
export function createBoot(el, total) {
  const n = el.querySelector('#boot-n'), bar = el.querySelector('#boot-bar');
  let done = 0;
  const show = () => { n.textContent = `${done} / ${total}`; bar.style.setProperty('--p', done / total); };
  show();
  return {
    step() { done = Math.min(total, done + 1); show(); },
    hide(now) {
      if (now) { el.remove(); return; }
      el.classList.add('done'); // 短くフェード（CSS の transition）してから外す
      setTimeout(() => el.remove(), 500);
    },
  };
}
