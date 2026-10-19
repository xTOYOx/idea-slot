// 「キー設定」画面（PC のみ）。操作ごとのキーのボタンを押して、次に押したキーを割り当てる。
// 並べ替え・検証は keys.js の純粋関数。変えたら changed() で app.js に知らせる（使い方の「キー操作」を作り直す）。
import { ACTIONS, DEFAULT_KEYS, assignKey, keyName, canonCode } from './keys.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const label = id => ACTIONS.find(a => a.id === id).label;

export function initKeyScreen({ store, changed }) {
  const dlg = document.getElementById('keys'), body = dlg.querySelector('.body');
  let capturing = null, note = '', err = false, upCode = null; // capturing: キー待ちの操作。upCode: 割り当てたキーが離されるまで、離したときのクリックを止める

  const keys = () => store.state.settings.keys;
  function render(focus) {
    body.innerHTML = `<h2>キー設定</h2>
      <ul class="list krows">${ACTIONS.map(a => {
        const on = capturing === a.id;
        return `<li><span>${esc(a.label)}</span><button data-act="key" data-a="${a.id}" aria-pressed="${on}" aria-label="${esc(a.label)}のキー：${esc(keyName(keys()[a.id]))}">${on ? 'キーを押してください（Esc でやめる）' : esc(keyName(keys()[a.id]))}</button></li>`;
      }).join('')}</ul>
      <p class="hint">ポーズ：Esc（固定）</p>
      <p class="${err ? 'err' : 'note'}" role="status">${esc(note)}</p>
      <div class="row"><button data-act="reset">初期設定に戻す</button></div>`;
    if (focus) body.querySelector(`[data-a="${focus}"]`)?.focus({ preventScroll: true });
  }
  const say = (text, isErr = false, focus) => { note = text; err = isErr; render(focus); };

  document.querySelector('[data-open="keys"]').onclick = () => { capturing = null; say(''); dlg.showModal(); };
  dlg.querySelector('[data-close]').onclick = () => dlg.close();
  dlg.addEventListener('close', () => { capturing = null; note = ''; });
  dlg.addEventListener('cancel', e => { if (capturing) e.preventDefault(); }); // キー待ちの Esc は「やめる」だけで、画面は閉じない

  dlg.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    if (b.dataset.act === 'key') { capturing = b.dataset.a; say('', false, capturing); return; }
    capturing = null;
    store.state.settings.keys = { ...DEFAULT_KEYS };
    store.save('settings');
    changed();
    say('初期設定に戻しました', false, 'lever');
  });

  // キー待ちの間は、押したキーを全部ここで受ける（ブラウザのショートカット Ctrl/Alt/Meta + キー は通す）
  document.addEventListener('keydown', e => {
    if (!capturing || !dlg.open || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    const action = capturing;
    if (e.code === 'Escape') { capturing = null; say('', false, action); return; }
    const code = canonCode(e.code), r = assignKey(keys(), action, code);
    if (!r) { say(`「${keyName(code)}」は割り当てられません`, true, action); return; }
    store.state.settings.keys = r.keys;
    store.save('settings');
    changed();
    capturing = null;
    upCode = e.code;
    say(r.swapped ? `「${keyName(code)}」を使っていた「${label(r.swapped)}」と入れ替えました` : `「${label(action)}」を「${keyName(code)}」にしました`, false, action);
  }, true);
  // 割り当てたキー（スペースなど）を離したとき、フォーカスの戻ったボタンが押されたことにならないように
  document.addEventListener('keyup', e => { if (upCode === e.code) { upCode = null; if (dlg.open) e.preventDefault(); } }, true);
}
