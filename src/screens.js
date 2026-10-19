// Dialog screen: export/import. ctx comes from app.js.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initScreens({ store, isSpinning, afterImport }) {
  const body = id => document.querySelector(`#${id} .body`);
  let importError = '';

  const views = {
    settings() {
      return `<h2>書き出し・読み込み</h2>
        <div class="row"><button data-act="export">書き出す</button>
        <button data-act="import">読み込む</button><input type="file" accept="application/json,text/plain,.json" hidden></div>
        <p class="err" role="alert">${esc(importError)}</p>`;
    },
  };
  const show = id => { body(id).innerHTML = views[id](); };

  const handlers = {
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

  document.getElementById('settings').addEventListener('change', async e => {
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
