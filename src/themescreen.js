// 「テーマ」画面（自作テーマの一覧・作成・編集）。データの変更は mythemes.js の純粋関数で行い、app.js へは changed(remap) で知らせる。
import { parseWords, addWords, removeWord, createTheme, renameTheme, deleteTheme } from './mythemes.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const label = t => `★${t.name}（${t.words.length}語）`;

// changed(remap?): 一覧が変わったとき。名前変更は {from, to}、削除は {from, to: null}
export function initThemeScreen({ store, isSpinning, changed }) {
  const dlg = document.getElementById('themes'), body = dlg.querySelector('.body');
  let open = null, err = '', note = '', draft = ''; // draft: エラーで戻したときに残す名前の入力値 // open: いま開いているテーマの名前（null なら一覧）

  const cur = () => store.state.themes.find(t => t.name === open);
  const set = (themes, remap) => { store.state.themes = themes; store.save('themes'); changed(remap); };
  const errP = () => `<p class="err" role="alert">${esc(err)}</p>`;
  const noteP = () => `<p class="note" role="status">${esc(note)}</p>`;

  function render() {
    const t = cur();
    if (open !== null && !t) open = null;
    body.innerHTML = !t
      ? `<h2>テーマ</h2>
        <form class="row" data-form="new"><input name="name" value="${esc(draft)}" placeholder="新しいテーマの名前" aria-label="テーマの名前" autocomplete="off"><button>作成</button></form>
        ${errP()}
        ${store.state.themes.length ? `<ul class="list">${store.state.themes.map((x, i) => `<li><button data-act="open" data-i="${i}">${esc(label(x))}</button></li>`).join('')}</ul>` : '<p>テーマはまだありません</p>'}`
      : `<button data-act="back">← 一覧</button>
        <h2>${esc(label(t))}</h2>
        <form class="row" data-form="rename"><input name="name" value="${esc(draft || t.name)}" aria-label="テーマの名前" autocomplete="off"><button>名前を変更</button></form>
        ${errP()}
        <div class="row"><button data-act="del">削除</button></div>
        <h3>語を追加</h3>
        <form data-form="add"><textarea name="words" rows="4" placeholder="1語ずつ、または改行・、・, 区切りでまとめて" aria-label="追加する語"></textarea>
        <div class="row"><button>追加</button></div></form>
        ${noteP()}
        <h3>語（${t.words.length}）</h3>
        ${t.words.length ? `<ul class="list">${t.words.map((w, i) => `<li class="row"><span>${esc(w)}</span><button data-act="rmw" data-i="${i}" aria-label="「${esc(w)}」を外す">×</button></li>`).join('')}</ul>` : '<p>語はまだありません</p>'}`;
  }
  const show = (nextErr = '', nextNote = '') => { err = nextErr; note = nextNote; draft = ''; render(); };
  // 名前の入力でエラー: 入力値を残して、入力欄に focus を戻す
  const nameError = (msg, value) => { err = msg; note = ''; draft = value; render(); body.querySelector('input[name=name]')?.focus({ preventScroll: true }); };

  document.querySelector('[data-open="themes"]').onclick = () => { if (isSpinning()) return; open = null; show(); dlg.showModal(); };
  dlg.querySelector('[data-close]').onclick = () => dlg.close();
  dlg.addEventListener('close', () => { open = null; err = note = ''; });

  dlg.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b || isSpinning()) return;
    const t = cur(), i = Number(b.dataset.i);
    if (!t && b.dataset.act !== 'open') return; // 一覧にいるときは「開く」だけ
    if (b.dataset.act === 'open') { open = store.state.themes[i].name; show(); }
    else if (b.dataset.act === 'back') { open = null; show(); }
    else if (b.dataset.act === 'rmw') { set(store.state.themes.map(x => (x === t ? removeWord(x, t.words[i]) : x))); show(); }
    else if (b.dataset.act === 'del' && confirm(`テーマ「${t.name}」を削除します。このテーマのリールは「全部ランダム」に戻ります`)) {
      set(deleteTheme(store.state.themes, t.name), { from: t.name, to: null });
      open = null;
      show();
    }
  });

  dlg.addEventListener('submit', e => {
    e.preventDefault();
    if (isSpinning()) return;
    const f = e.target, t = cur(), name = f.elements.name?.value.trim();
    if (f.dataset.form === 'new') {
      const next = createTheme(store.state.themes, name);
      if (!next) { nameError(name ? 'その名前はすでにあります' : '名前を入れてください', f.elements.name.value); return; }
      set(next);
      open = name;
      show();
    } else if (f.dataset.form === 'rename') {
      const next = renameTheme(store.state.themes, t.name, name);
      if (!next) { nameError(name ? 'その名前はすでにあります' : '名前を入れてください', f.elements.name.value); return; }
      if (name !== t.name) set(next, { from: t.name, to: name });
      open = name;
      show();
    } else if (f.dataset.form === 'add') {
      const words = parseWords(f.elements.words.value);
      if (!words.length) { show('', '語を入れてください'); return; }
      const r = addWords(t, words);
      store.unexclude(words); // 除外中の語を足したら、除外を外す（「自分の語」と同じ）
      set(store.state.themes.map(x => (x === t ? r.theme : x)));
      show('', r.added ? `${r.added}語を追加しました` : 'すでに入っている語です');
      body.querySelector('textarea')?.focus({ preventScroll: true });
    }
  });
}
