// Dialog screens: custom words, settings. ctx comes from app.js.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initScreens({ store, typeLabels, typeKeys, isSpinning, rebuildPools, onSettingsChange, afterImport }) {
  const body = id => document.querySelector(`#${id} .body`);
  const customKeys = typeKeys.filter(k => !['noun', 'tag', 'any'].includes(k));
  let importError = '';

  const views = {
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
        <label><input type="checkbox" data-act="reduce"${store.state.settings.reduceMotion ? ' checked' : ''}> 演出を減らす</label>
        <label>筐体の横幅（PC向け。スマホでは画面幅に合わせます）<span class="row"><input type="range" data-act="width" min="460" max="1400" step="20" value="${store.state.settings.width}" aria-label="筐体の横幅"> <output>${store.state.settings.width}px</output></span></label>
        <div class="row"><button data-act="export">書き出す</button>
        <button data-act="import">読み込む</button><input type="file" accept="application/json,text/plain,.json" hidden></div>
        <p class="err" role="alert">${esc(importError)}</p>`;
    },
  };
  const show = id => { body(id).innerHTML = views[id](); };
  const changed = key => { store.save(key); rebuildPools(); };

  const handlers = {
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
      const url = URL.createObjectURL(new Blob([store.exportJSON()], { type: 'application/json' }));
      a.href = url;
      a.download = `idea-slot-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  document.getElementById('custom').addEventListener('submit', e => {
    e.preventDefault();
    const { type, word } = e.target.elements;
    const w = word.value.trim();
    if (!w) return;
    const t = type.value;
    const list = store.state.custom[t] ??= [];
    if (!list.includes(w)) list.push(w);
    const ex = store.state.excluded.indexOf(w);
    if (ex >= 0) { store.state.excluded.splice(ex, 1); store.save('excluded'); }
    changed('custom');
    show('custom');
    document.querySelector('#custom select[name=type]').value = t;
  });

  // 横幅はスライダーを動かしている間も反映し、離したときに保存する
  document.getElementById('settings').addEventListener('input', e => {
    if (e.target.dataset.act !== 'width') return;
    store.state.settings.width = Number(e.target.value);
    e.target.nextElementSibling.textContent = `${e.target.value}px`;
    onSettingsChange();
  });
  document.getElementById('settings').addEventListener('change', async e => {
    if (e.target.dataset.act === 'width') { store.save('settings'); return; }
    if (e.target.dataset.act === 'reduce') { store.state.settings.reduceMotion = e.target.checked; store.save('settings'); onSettingsChange(); return; }
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
