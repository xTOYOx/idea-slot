// 「キー設定」画面（PC のみ）。操作ごとのキーのボタンを押して、次に押したキーを割り当てる。
// 検証・重複の判定は keys.js の純粋関数。同じキーを複数の操作に割り当ててよい（重複したキーのボタンは赤く、下に一行出す）。変えたら changed() で app.js に知らせる（使い方の「キー操作」を作り直す）。
// 上の「標準／詳細」で切り替える。詳細は keysDetail（リール・レバー・引き出しを細かく分ける。Delete で「なし」）。IDEA!・リールの増減・使い方は両方で共通（keys）
import { ACTIONS, DETAIL_ACTIONS, DEFAULT_KEYS, DEFAULT_DETAIL, SHARED, assignKey, dupCodes, keyName, canonCode } from './keys.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const label = id => [...ACTIONS, ...DETAIL_ACTIONS].find(a => a.id === id).label;
const NUMS = [1, 2, 3, 4, 5, 6, 7];
const PROMPT = 'キーを押してください（Esc でやめる';

export function initKeyScreen({ store, changed }) {
  const dlg = document.getElementById('keys'), body = dlg.querySelector('.body');
  let capturing = null, note = '', err = false, upCode = null; // capturing: キー待ちの操作。upCode: 割り当てたキーが離されるまで、離したときのクリックを止める

  const st = () => store.state.settings;
  const detail = () => st().keyMode === 'detail';
  const mapName = id => (detail() && !SHARED.includes(id) ? 'keysDetail' : 'keys'); // その操作のキーを持つ設定
  const canNull = id => mapName(id) === 'keysDetail'; // 「なし」にできるのは詳細のキーだけ
  function render(focus) {
    const dup = dupCodes(st().keys, detail() ? st().keysDetail : undefined);
    const kbtn = (id, name, cell) => {
      const code = st()[mapName(id)][id], d = dup.has(code), on = capturing === id, text = code ? keyName(code) : 'なし';
      return `<button data-act="key"${d ? ' class="dup"' : ''} data-a="${id}" aria-pressed="${on}" aria-label="${esc(name)}のキー：${esc(text)}${d ? '（ほかの操作と同じキー）' : ''}">${on ? (cell ? 'キーを押す' : hintFor(id)) : esc(text)}</button>`;
    };
    const list = ids => `<ul class="list krows">${ids.map(id => `<li><span>${esc(label(id))}</span>${kbtn(id, label(id))}</li>`).join('')}</ul>`;
    const modes = [['basic', '標準'], ['detail', '詳細']].map(([m, t]) => `<button data-act="mode" data-a="${m}" aria-pressed="${st().keyMode === m}">${t}</button>`).join('');
    body.innerHTML = `<h2>キー設定</h2>
      <div class="row kmode" role="group" aria-label="キーの種類">${modes}</div>
      ${detail() ? `<p class="hint">詳細では、レバー・リール・引き出しのキーが細かく分かれます。同じまとまりの中ではキーが重なってもかまいません</p>
      <h3>レバー</h3>${list(['spin', 'stopAll'])}
      <h3>リール</h3>
      <div class="kgrid"><span></span><b>止める</b><b>ロック</b><b>解除</b>${NUMS.map(n => `<span>${n}番リール</span>${['stop', 'lock', 'unlock'].map(p => kbtn(p + n, label(p + n), true)).join('')}`).join('')}</div>
      <h3>全部</h3>${list(['lockAll', 'unlockAll'])}
      <h3>引き出し</h3>${list(['histOpen', 'histClose', 'hitsOpen', 'hitsClose', 'tplOpen', 'tplClose'])}
      <h3>その他</h3>${list(SHARED)}` : list(ACTIONS.map(a => a.id))}
      <p class="hint">ポーズ：Esc（固定）</p>
      ${dup.size ? '<p class="err">同じキーが複数の操作にあります（どれも動きます）</p>' : ''}
      <p class="${err ? 'err' : 'note'}" role="status">${esc(note)}</p>
      <div class="row"><button data-act="reset">初期設定に戻す</button></div>`;
    if (focus) body.querySelector(`[data-a="${focus}"]`)?.focus({ preventScroll: true });
  }
  const hintFor = id => PROMPT + (canNull(id) ? '・Delete でなし）' : '）');
  const say = (text, isErr = false, focus) => { note = text; err = isErr; render(focus); };

  document.querySelector('[data-open="keys"]').onclick = () => { capturing = null; say(''); dlg.showModal(); };
  dlg.querySelector('[data-close]').onclick = () => dlg.close();
  dlg.addEventListener('close', () => { capturing = null; note = ''; });
  dlg.addEventListener('cancel', e => { if (capturing) e.preventDefault(); }); // キー待ちの Esc は「やめる」だけで、画面は閉じない

  dlg.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    if (b.dataset.act === 'key') { capturing = b.dataset.a; say(/^(?:stop|lock|unlock)\d$/.test(capturing) ? hintFor(capturing) : '', false, capturing); return; } // 表のボタンは狭いので、案内は下の一行に
    capturing = null;
    if (b.dataset.act === 'mode') {
      st().keyMode = b.dataset.a;
      store.save('settings');
      changed();
      say('', false, b.dataset.a);
      return;
    }
    if (detail()) { // 詳細: 詳細のキーと、共通の4つを戻す
      st().keysDetail = { ...DEFAULT_DETAIL };
      st().keys = { ...st().keys, ...Object.fromEntries(SHARED.map(id => [id, DEFAULT_KEYS[id]])) };
    } else st().keys = { ...DEFAULT_KEYS };
    store.save('settings');
    changed();
    say('初期設定に戻しました', false, detail() ? 'spin' : 'lever');
  });

  // キー待ちの間は、押したキーを全部ここで受ける（ブラウザのショートカット Ctrl/Alt/Meta + キー は通す）
  document.addEventListener('keydown', e => {
    if (!capturing || !dlg.open || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    const action = capturing;
    if (e.code === 'Escape') { capturing = null; say('', false, action); return; }
    const map = mapName(action), none = canNull(action) && (e.code === 'Delete' || e.code === 'Backspace'); // Delete / Backspace で「なし」
    const code = none ? null : canonCode(e.code), next = none ? { ...st()[map], [action]: null } : assignKey(st()[map], action, code);
    if (!next) { say(`「${keyName(code)}」は割り当てられません`, true, action); return; }
    st()[map] = next;
    store.save('settings');
    changed();
    capturing = null;
    upCode = e.code;
    say(none ? `「${label(action)}」をなしにしました` : `「${label(action)}」を「${keyName(code)}」にしました`, false, action);
  }, true);
  // 割り当てたキー（スペースなど）を離したとき、フォーカスの戻ったボタンが押されたことにならないように
  document.addEventListener('keyup', e => { if (upCode === e.code) { upCode = null; if (dlg.open) e.preventDefault(); } }, true);
}
