// 左端の「テンプレ」引き出しの中身。今のリールの構成（本数と各リールの種類）に名前を付けて保存し、呼び出す。
// 並べ替え・検証は templates.js の純粋関数。current(): 今の構成 [{type}]、label(type): 種類の表示名、use(t): 適用して振り直す（できたら true）、count(n): 件数のバッジ
// 返す render() は全体の描き直し（保存データが入れ替わったとき）、refresh() は構成の表示だけの更新（入力中の名前を壊さない）
import { describeSlots, addTemplate, replaceTemplate, removeTemplate } from './templates.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initTemplateScreen({ store, isSpinning, current, label, use, count }) {
  const body = document.getElementById('tpl');
  let err = '', note = '', draft = ''; // draft: エラーで戻したときに残す名前の入力値

  const list = () => store.state.templates;
  const set = next => { store.state.templates = next; store.save('templates'); };
  function render() {
    const mine = list(), off = isSpinning() ? ' disabled' : ''; // 回転中は使う・上書き・保存を押せない（止まったら app.js の sync が戻す）
    body.innerHTML = `<h4>今の構成</h4>
      <p class="cur">${esc(describeSlots(current(), label))}</p>
      <form class="row" data-form="save"><input name="name" value="${esc(draft)}" placeholder="テンプレートの名前" aria-label="テンプレートの名前" autocomplete="off"><button class="sbtn" data-edit${off}>今の構成を保存</button></form>
      <p class="err" role="alert">${esc(err)}</p><p class="note" role="status">${esc(note)}</p>
      <h4>保存したテンプレート</h4>
      ${mine.length ? `<ul class="list tpl">${mine.map((t, i) => `<li><b>${esc(t.name)}</b><span>${esc(describeSlots(t.slots, label))}</span>
        <div class="row"><button class="sbtn" data-edit${off} data-act="use" data-i="${i}">使う</button><button class="sbtn" data-edit${off} data-act="over" data-i="${i}">上書き</button><button class="sbtn" data-act="del" data-i="${i}">削除</button></div></li>`).join('')}</ul>` : '<p>まだありません</p>'}`;
    count(mine.length);
  }
  const refresh = () => {
    const cur = body.querySelector('.cur');
    if (!cur) return; // まだ描いていない（起動中）
    cur.textContent = describeSlots(current(), label);
    body.querySelectorAll('.tpl span').forEach((el, i) => { el.textContent = describeSlots(list()[i].slots, label); }); // テーマの名前が変わった・消えたとき
  };
  const show = (nextErr = '', nextNote = '') => { err = nextErr; note = nextNote; draft = ''; render(); };
  const focus = sel => body.querySelector(sel)?.focus({ preventScroll: true });

  body.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const i = Number(b.dataset.i), t = list()[i];
    if (!t) return;
    if (b.dataset.act === 'del') {
      if (confirm(`テンプレート「${t.name}」を削除します`)) { set(removeTemplate(list(), t.name)); show('', `「${t.name}」を削除しました`); focus('input[name=name]'); }
    } else if (isSpinning()) return;
    else if (b.dataset.act === 'use') use(t); // 引き出しは開いたまま（リールが切り替わるのを見せる）
    else { set(replaceTemplate(list(), t.name, current())); show('', `「${t.name}」を今の構成で上書きしました`); focus(`[data-act="over"][data-i="${i}"]`); }
  });

  body.addEventListener('submit', e => {
    e.preventDefault();
    if (isSpinning()) return;
    const input = e.target.elements.name, name = input.value.trim(), next = addTemplate(list(), name, current());
    if (!next) {
      err = name ? 'その名前はすでにあります' : '名前を入れてください';
      note = '';
      draft = input.value;
      render();
      focus('input[name=name]');
      return;
    }
    set(next);
    show('', `「${name}」を保存しました`);
    focus('input[name=name]');
  });

  return { render, refresh };
}
