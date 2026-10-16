// Dialog screens: favorites, custom words, settings. ctx comes from app.js.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initScreens({ store, typeLabels, typeKeys, isSpinning, rebuildPools, restoreCombo, afterImport }) {
  const body = id => document.querySelector(`#${id} .body`);
  const customKeys = typeKeys.filter(k => !['noun', 'tag', 'any'].includes(k));
  let importError = '';

  const views = {
    favorites() {
      const rows = store.state.favorites.map((f, i) => `<li><div class="combo">${esc(f.combo.join(' × '))}</div>
        <input data-act="memo" data-i="${i}" value="${esc(f.memo)}" placeholder="メモ" aria-label="メモ">
        <div class="row"><button data-act="back" data-i="${i}">枠に戻す</button><button data-act="del" data-i="${i}">削除</button></div></li>`).join('');
      return `<h2>お気に入り</h2>${rows ? `<ul class="list">${rows}</ul>` : '<p>まだありません</p>'}`;
    },
    custom() {
      const opts = customKeys.map(k => `<option value="${k}">${esc(typeLabels[k])}</option>`).join('');
      const groups = Object.entries(store.state.custom).filter(([, ws]) => ws.length).map(([k, ws]) =>
        `<h3>${esc(typeLabels[k] ?? k)}</h3><ul class="list">${ws.map((w, i) =>
          `<li class="row"><span>${esc(w)}</span><button data-act="rm" data-k="${esc(k)}" data-i="${i}">削除</button></li>`).join('')}</ul>`).join('');
      const ex = store.state.excluded.map((w, i) =>
        `<li class="row"><span>${esc(w)}</span><button data-act="unex" data-i="${i}">戻す</button></li>`).join('');
      return `<h2>自分の語</h2>
        <form class="row"><select name="type" aria-label="種類">${opts}</select>
        <input name="word" placeholder="語" required aria-label="語"><button>追加</button></form>
        ${groups || '<p>追加した語はありません</p>'}
        <h2>除外した語</h2>${ex ? `<ul class="list">${ex}</ul>` : '<p>ありません</p>'}`;
    },
    settings() {
      return `<h2>設定</h2>
        <label><input type="checkbox" data-act="anim"${store.state.settings.animate ? ' checked' : ''}> 演出（回転アニメ）</label>
        <div class="row"><button data-act="export">書き出す</button>
        <button data-act="import">読み込む</button><input type="file" accept=".json,application/json" hidden></div>
        <p class="err" role="alert">${esc(importError)}</p>`;
    },
  };
  const show = id => { body(id).innerHTML = views[id](); };
  const changed = key => { store.save(key); rebuildPools(); };

  const handlers = {
    back(el) { restoreCombo(store.state.favorites[Number(el.dataset.i)].combo); el.closest('dialog').close(); },
    del(el) { store.state.favorites.splice(Number(el.dataset.i), 1); store.save('favorites'); show('favorites'); },
    rm(el) {
      const list = store.state.custom[el.dataset.k];
      list.splice(Number(el.dataset.i), 1);
      if (!list.length) delete store.state.custom[el.dataset.k];
      changed('custom'); show('custom');
    },
    unex(el) { store.state.excluded.splice(Number(el.dataset.i), 1); changed('excluded'); show('custom'); },
    export() {
      const d = new Date();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([store.exportJSON()], { type: 'application/json' }));
      a.download = `idea-slot-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    import(el) { el.parentElement.querySelector('input[type=file]').click(); },
  };

  for (const id of Object.keys(views)) {
    const dlg = document.getElementById(id);
    document.querySelector(`[data-open="${id}"]`).onclick = () => { if (isSpinning()) return; show(id); dlg.showModal(); };
    dlg.querySelector('[data-close]').onclick = () => dlg.close();
    dlg.addEventListener('click', e => { const el = e.target.closest('button[data-act]'); if (el) handlers[el.dataset.act]?.(el); });
    dlg.addEventListener('close', () => { importError = ''; });
  }

  document.getElementById('favorites').addEventListener('input', e => {
    if (e.target.dataset.act !== 'memo') return;
    store.state.favorites[Number(e.target.dataset.i)].memo = e.target.value;
    store.save('favorites');
  });

  document.getElementById('custom').addEventListener('submit', e => {
    e.preventDefault();
    const { type, word } = e.target.elements;
    const w = word.value.trim();
    if (!w) return;
    const t = type.value;
    const list = store.state.custom[t] ??= [];
    if (!list.includes(w)) list.push(w);
    changed('custom');
    show('custom');
    document.querySelector('#custom select[name=type]').value = t;
  });

  document.getElementById('settings').addEventListener('change', async e => {
    if (e.target.dataset.act === 'anim') { store.state.settings.animate = e.target.checked; store.save('settings'); return; }
    if (e.target.type !== 'file' || !e.target.files[0]) return;
    const file = e.target.files[0];
    e.target.value = '';
    if (!confirm('今のデータを上書きします')) return;
    const r = store.importJSON(await file.text());
    importError = r.ok ? '' : r.error;
    if (r.ok) afterImport();
    show('settings');
  });
}
