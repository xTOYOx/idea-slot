// 「テーマ」画面。全部のテーマ（元からある種類・自作テーマ）の一覧と、その中身（語の追加・除外・絞り込み）を扱う。
// 語の組み立ては wordlist.js / mythemes.js の純粋関数で行い、app.js へは changed(remap) で知らせる。
import { parseWords, addWords, removeWord, createTheme, renameTheme, deleteTheme } from './mythemes.js';
import { baseWords } from './pools.js';
import { wordCount, wordRows, newCustom } from './wordlist.js';
import { TYPE_LABELS, typeGroups } from './types.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PAGE = 300; // 一度に描く語の数（「もっと見る」で増やす）
// 全部ランダム・単語（全部）・タグ（全部）は、ほかの分類をまとめただけなので出さない
const groups = typeGroups([]).map(g => ({ ...g, items: g.items.filter(x => !['any', 'noun', 'tag'].includes(x.k)) })).filter(g => g.items.length);

// changed(remap?): 一覧や語が変わったとき。名前変更は {from, to}、削除は {from, to: null}
export function initThemeScreen({ store, data, isSpinning, changed }) {
  const dlg = document.getElementById('themes'), body = dlg.querySelector('.body');
  // view: {v:'list'} 一覧 / {v:'type', k} 元からある種類 / {v:'my', name} 自作テーマ / {v:'ex'} 除外した語
  let view = { v: 'list' }, q = '', limit = PAGE, err = '', note = '', draft = null; // draft: エラーで戻したときに残す名前の入力値

  const cur = () => (view.v === 'my' ? store.state.themes.find(t => t.name === view.name) : undefined);
  const excluded = () => store.state.excluded;
  const customOf = k => store.state.custom[k] ?? [];
  const set = (themes, remap) => { store.state.themes = themes; store.save('themes'); changed(remap); };
  const errP = () => `<p class="err" role="alert">${esc(err)}</p>`;
  const noteP = () => `<p class="note" role="status">${esc(note)}</p>`;
  const exCount = () => new Set(excluded()).size;
  const grid = items => `<div class="tg">${items.join('')}</div>`;
  const hint = '<p class="hint">「除外」は種類をまたいで効きます（語の文字列で除外します）</p>';
  const search = '<div class="row"><input name="q" value="" placeholder="さがす" aria-label="さがす" autocomplete="off"></div>';

  // 見出しと語の一覧（絞り込み・もっと見るで作り直すのはこの部分だけ。さがす欄は作り直さない）
  function source() {
    const ex = excluded();
    if (view.v === 'type') {
      const base = baseWords(data, view.k), custom = customOf(view.k);
      return { head: `${TYPE_LABELS[view.k]}（${wordCount(base, custom, ex)}語）`, rows: wordRows({ base, custom, excluded: ex, q, limit }) };
    }
    if (view.v === 'my') {
      const t = cur();
      return { head: `★${t.name}（${wordCount(t.words, [], ex)}語）`, rows: wordRows({ base: t.words, excluded: ex, q, limit }) };
    }
    return { head: `除外した語（${exCount()}）`, rows: wordRows({ base: [], custom: ex, excluded: ex, q, limit }) };
  }
  function row({ w, kind }) {
    const W = esc(w), b = (act, text, aria) => `<button data-act="${act}" data-w="${W}" aria-label="「${W}」${aria}">${text}</button>`;
    if (kind === 'off') return `<li class="off"><span>${W}</span>${b('unex', '追加', 'を戻す（除外を外す）')}</li>`;
    if (view.v === 'my') return `<li><span>${W}</span>${b('rmw', '×', 'を外す')}</li>`;
    if (kind === 'added') return `<li><i class="mk">追加</i><span>${W}</span>${b('rmc', '×', 'を消す')}</li>`;
    return `<li><span>${W}</span>${b('ex', '除外', 'を除外')}</li>`;
  }
  function paintList() {
    const wl = body.querySelector('.wl');
    if (!wl) return;
    const { head, rows: { rows, total, more } } = source();
    body.querySelector('[data-count]').textContent = head;
    wl.innerHTML = (q.trim() ? `<p class="hint">「${esc(q.trim())}」に合う語：${total}語</p>` : '')
      + (rows.length ? `<ul class="wg">${rows.map(row).join('')}</ul>` : `<p>${q.trim() ? 'あてはまる語はありません' : view.v === 'ex' ? '除外した語はありません' : '語はまだありません'}</p>`)
      + (more ? `<button class="more" data-act="more">もっと見る（あと${more}語）</button>` : '');
  }

  function render() {
    if (view.v === 'my' && !cur()) view = { v: 'list' };
    const t = cur(), ex = excluded();
    if (view.v === 'list') {
      const mine = store.state.themes;
      body.innerHTML = `<h2>テーマ</h2>
        ${groups.map(g => `<h3>${esc(g.title)}</h3>${grid(g.items.map(x => `<button data-act="type" data-k="${esc(x.k)}">${esc(x.text)}<small>${wordCount(baseWords(data, x.k), customOf(x.k), ex)}語</small></button>`))}`).join('')}
        <h3>自分のテーマ</h3>
        <form class="row" data-form="new"><input name="name" value="${esc(draft ?? '')}" placeholder="新しいテーマの名前" aria-label="テーマの名前" autocomplete="off"><button>作成</button></form>
        ${errP()}
        ${mine.length ? grid(mine.map((x, i) => `<button data-act="open" data-i="${i}">★${esc(x.name)}<small>${wordCount(x.words, [], ex)}語</small></button>`)) : '<p>テーマはまだありません</p>'}
        <h3>除外した語</h3>
        ${grid([`<button data-act="exl">除外した語<small>${exCount()}語</small></button>`])}`;
      return;
    }
    const wl = `<h3>語</h3>${search}<div class="wl"></div>`;
    body.innerHTML = view.v === 'type'
      ? `<button data-act="back">← 一覧</button>
        <h2 data-count></h2>
        ${hint}
        <h3>語を追加</h3>
        <form data-form="addtype"><textarea name="words" rows="3" placeholder="1語ずつ、または改行・、・, 区切りでまとめて" aria-label="追加する語"></textarea>
        <div class="row"><button>追加</button></div></form>
        ${noteP()}
        ${wl}`
      : view.v === 'my'
        ? `<button data-act="back">← 一覧</button>
        <h2 data-count></h2>
        <form class="row" data-form="rename"><input name="name" value="${esc(draft ?? t.name)}" aria-label="テーマの名前" autocomplete="off"><button>名前を変更</button></form>
        ${errP()}
        <div class="row"><button data-act="del">削除</button></div>
        <h3>語を追加</h3>
        <form data-form="add"><textarea name="words" rows="4" placeholder="1語ずつ、または改行・、・, 区切りでまとめて" aria-label="追加する語"></textarea>
        <div class="row"><button>追加</button></div></form>
        ${noteP()}
        ${wl}`
        : `<button data-act="back">← 一覧</button>
        <h2 data-count></h2>
        ${hint}
        ${search}<div class="wl"></div>`;
    body.querySelector('input[name=q]').value = q;
    paintList();
  }
  const show = (nextErr = '', nextNote = '') => { err = nextErr; note = nextNote; draft = null; render(); };
  // 別の画面へ: 絞り込みと「もっと見る」を戻して、上から見せる
  const go = next => { view = next; q = ''; limit = PAGE; show(); dlg.scrollTop = 0; };
  // 名前の入力でエラー: 入力値を残して、入力欄に focus を戻す
  const nameError = (msg, value) => { err = msg; note = ''; draft = value; render(); body.querySelector('input[name=name]')?.focus({ preventScroll: true }); };

  document.querySelector('[data-open="themes"]').onclick = () => { if (isSpinning()) return; view = { v: 'list' }; q = ''; limit = PAGE; show(); dlg.showModal(); };
  dlg.querySelector('[data-close]').onclick = () => dlg.close();
  dlg.addEventListener('close', () => { view = { v: 'list' }; q = ''; limit = PAGE; err = note = ''; });
  dlg.addEventListener('input', e => { if (e.target.name === 'q') { q = e.target.value; limit = PAGE; paintList(); } });

  // 語の一覧を作り直したあと、押した行の位置（次の語）にフォーカスを戻す
  const refocus = n => { if (n >= 0) body.querySelector('.wl ul')?.children[n]?.querySelector('button')?.focus({ preventScroll: true }); };

  // store を更新したあと changed() が例外を投げても、画面は必ず今の store に合わせる（finally）
  dlg.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b || isSpinning()) return;
    const act = b.dataset.act, w = b.dataset.w, li = b.closest('li'), n = li ? [...li.parentElement.children].indexOf(li) : -1;
    if (act === 'open') { const name = store.state.themes[Number(b.dataset.i)]?.name; go(name === undefined ? { v: 'list' } : { v: 'my', name }); return; }
    if (act === 'type') { go({ v: 'type', k: b.dataset.k }); return; }
    if (act === 'exl') { go({ v: 'ex' }); return; }
    if (act === 'back') { go({ v: 'list' }); return; }
    if (act === 'more') {
      const old = limit;
      limit += PAGE;
      paintList();
      refocus(old); // 続きの先頭へ
      return;
    }
    if (act === 'ex') {
      try { excluded().push(w); store.save('excluded'); changed(); } finally { paintList(); refocus(n); }
    } else if (act === 'unex') {
      try { store.unexclude([w]); changed(); } finally { paintList(); refocus(n); }
    } else if (act === 'rmc') { // 追加した語を消す
      try {
        const rest = customOf(view.k).filter(x => x !== w);
        if (rest.length) store.state.custom[view.k] = rest; else delete store.state.custom[view.k];
        store.save('custom'); changed();
      } finally { paintList(); refocus(n); }
    } else if (act === 'rmw' || act === 'del') {
      const t = cur();
      if (!t) { go({ v: 'list' }); return; } // 開いているテーマが無い（外で消えた）: 一覧に戻す
      if (act === 'rmw') {
        try { set(store.state.themes.map(x => (x === t ? removeWord(x, w) : x))); } finally { paintList(); refocus(n); }
      } else if (confirm(`テーマ「${t.name}」を削除します。このテーマを使っているリールからは外れます（ほかに無ければ全部ランダム）`)) {
        try { set(deleteTheme(store.state.themes, t.name), { from: t.name, to: null }); } finally { go({ v: 'list' }); }
      }
    }
  });

  dlg.addEventListener('submit', e => {
    e.preventDefault();
    if (isSpinning()) return;
    const f = e.target, kind = f.dataset.form, t = cur(), name = f.elements.name?.value.trim();
    if (kind === 'addtype') {
      if (view.v !== 'type') return;
      const k = view.k, words = parseWords(f.elements.words.value);
      if (!words.length) { show('', '語を入れてください'); return; }
      const r = newCustom(baseWords(data, k), customOf(k), words), back = words.filter(x => excluded().includes(x)).length;
      if (r.added) { store.state.custom[k] = r.custom; store.save('custom'); }
      store.unexclude(words); // 除外中の語を足したら、除外を外す
      try { if (r.added || back) changed(); } finally {
        show('', [r.added && `${r.added}語を追加しました`, back && `${back}語の除外を外しました`].filter(Boolean).join(' ') || 'すでに入っている語です');
        body.querySelector('textarea')?.focus({ preventScroll: true });
      }
      return;
    }
    if (!t && kind !== 'new') { go({ v: 'list' }); return; }
    if (kind === 'new') {
      const next = createTheme(store.state.themes, name);
      if (!next) { nameError(name ? 'その名前はすでにあります' : '名前を入れてください', f.elements.name.value); return; }
      try { set(next); } finally { go({ v: 'my', name }); }
    } else if (kind === 'rename') {
      const next = renameTheme(store.state.themes, t.name, name);
      if (!next) { nameError(name ? 'その名前はすでにあります' : '名前を入れてください', f.elements.name.value); return; }
      try { if (name !== t.name) set(next, { from: t.name, to: name }); } finally { view = { v: 'my', name }; show(); }
    } else if (kind === 'add') {
      const words = parseWords(f.elements.words.value);
      if (!words.length) { show('', '語を入れてください'); return; }
      const r = addWords(t, words);
      store.unexclude(words); // 除外中の語を足したら、除外を外す
      try { set(store.state.themes.map(x => (x === t ? r.theme : x))); } finally {
        show('', r.added ? `${r.added}語を追加しました` : 'すでに入っている語です');
        body.querySelector('textarea')?.focus({ preventScroll: true });
      }
    }
  });
}
