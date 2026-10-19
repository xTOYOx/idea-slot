// 「テンプレート」画面。今のリールの構成（本数と各リールの種類）に名前を付けて保存し、呼び出す。
// 並べ替え・検証は templates.js の純粋関数。current(): 今の構成 [{type}]、label(type): 種類の表示名、use(t): 適用して振り直す（できたら true）、close(): ポーズに戻らず閉じる
import { describeSlots, addTemplate, replaceTemplate, removeTemplate } from './templates.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initTemplateScreen({ store, isSpinning, current, label, use, close }) {
  const dlg = document.getElementById('templates'), body = dlg.querySelector('.body');
  let err = '', note = '', draft = ''; // draft: エラーで戻したときに残す名前の入力値

  const list = () => store.state.templates;
  const set = next => { store.state.templates = next; store.save('templates'); };
  function render() {
    const mine = list();
    body.innerHTML = `<h2>テンプレート</h2>
      <h3>今の構成を保存</h3>
      <p class="cur">${esc(describeSlots(current(), label))}</p>
      <form class="row" data-form="save"><input name="name" value="${esc(draft)}" placeholder="テンプレートの名前" aria-label="テンプレートの名前" autocomplete="off"><button>保存</button></form>
      <p class="err" role="alert">${esc(err)}</p><p class="note" role="status">${esc(note)}</p>
      <h3>保存したテンプレート</h3>
      ${mine.length ? `<ul class="list tpl">${mine.map((t, i) => `<li><b>${esc(t.name)}</b><span>${esc(describeSlots(t.slots, label))}</span>
        <div class="row"><button data-act="use" data-i="${i}">使う</button><button data-act="over" data-i="${i}">上書き</button><button data-act="del" data-i="${i}">削除</button></div></li>`).join('')}</ul>` : '<p>まだありません</p>'}`;
  }
  const show = (nextErr = '', nextNote = '') => { err = nextErr; note = nextNote; draft = ''; render(); };
  const focus = sel => body.querySelector(sel)?.focus({ preventScroll: true });

  document.querySelector('[data-open="templates"]').onclick = () => { if (isSpinning()) return; show(); dlg.showModal(); };
  dlg.querySelector('[data-close]').onclick = () => dlg.close();
  dlg.addEventListener('close', () => { err = note = ''; draft = ''; });

  dlg.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b || isSpinning()) return;
    const i = Number(b.dataset.i), t = list()[i];
    if (!t) return;
    if (b.dataset.act === 'use') { if (use(t)) close(); }
    else if (b.dataset.act === 'over') { set(replaceTemplate(list(), t.name, current())); show('', `「${t.name}」を今の構成で上書きしました`); focus(`[data-act="over"][data-i="${i}"]`); }
    else if (confirm(`テンプレート「${t.name}」を削除します`)) { set(removeTemplate(list(), t.name)); show('', `「${t.name}」を削除しました`); focus('input[name=name]'); }
  });

  dlg.addEventListener('submit', e => {
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
}
