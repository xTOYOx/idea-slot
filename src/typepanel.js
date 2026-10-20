import { checkedKeys, groupState } from './typekey.js';
// リールの種類（テーマ）えらびの大きなパネル。DOM だけを扱い、選択の状態は app.js が持つ。
// toggle(k): 種類 k が押された。toggleGroup(g): 見出し g（typeGroups の要素）のチェックが押された。pickWord(i): 「語を検索してえらぶ」。restore(i): 閉じたあと（ほかのダイアログが無ければ）モニターへフォーカスを戻す
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initTypePanel({ toggle, toggleGroup, pickWord, restore }) {
  const dlg = document.getElementById('types'), body = dlg.querySelector('.tbody'), title = dlg.querySelector('h3'), now = dlg.querySelector('small');
  let idx = -1, last = -1, groups = [];

  // keys: いま選ばれている種類キー、text: その表示。切り替えても中身は作り直さない（スクロールとフォーカスを保つ）
  function mark(keys, text) {
    const c = checkedKeys(keys, groups); // まとめが選ばれていれば、その中身にもチェック
    body.querySelectorAll('[data-ty]').forEach(b => b.setAttribute('aria-checked', String(c.has(b.dataset.ty))));
    body.querySelectorAll('[data-grp]').forEach(b => b.setAttribute('aria-checked', groupState(keys, groups[b.dataset.grp])));
    now.textContent = `いま：${text}`;
  }
  const api = {
    index: () => idx,
    open(i, gs, keys, text) {
      idx = last = i;
      groups = gs;
      title.firstChild.textContent = `${i + 1}番リールのテーマ`;
      body.innerHTML = groups.map((g, gi) => `<section>${g.title ? `<h4><button role="checkbox" aria-checked="false" data-grp="${gi}"><i class="cb"></i>${esc(g.title)}</button></h4>` : ''}<div class="tg">${g.items.map(x =>
        `<button role="checkbox" aria-checked="false" data-ty="${esc(x.k)}"><i class="cb"></i>${esc(x.text)}</button>`).join('')}</div></section>`).join('');
      mark(keys, text);
      dlg.showModal();
      (body.querySelector('[aria-checked=true]') ?? body.querySelector('button'))?.focus({ preventScroll: true });
    },
    mark,
    close() { if (dlg.open) dlg.close(); },
  };

  dlg.addEventListener('close', () => {
    if (dlg.open) return; // 閉じてすぐ開き直したときの遅れて届いた close は無視
    idx = -1;
    if (!document.querySelector('dialog[open]')) restore(last); // 語えらびへ移ったときは、そちらのフォーカスを奪わない
  });
  dlg.addEventListener('click', e => {
    if (e.target === dlg) { // バックドロップかパネルの余白か: 座標で外側だけ閉じる
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
      return;
    }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.ty !== undefined) toggle(b.dataset.ty);
    else if (b.dataset.grp !== undefined) toggleGroup(groups[b.dataset.grp]);
    else if (b.dataset.close !== undefined) dlg.close();
    else if (b.dataset.pw !== undefined) { const i = idx; dlg.close(); pickWord(i); }
  });
  return api;
}
