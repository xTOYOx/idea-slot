// 共有リンクで届いたテーマ・テンプレートを見せて、「追加する」を押したときだけ保存する（share.js が中身の検証と名前の付け替え）。
// themesChanged(): 自作テーマが増えたあとの更新、templatesChanged(): テンプレが増えたあとの更新（app.js）
import { codeFromHash, decodeShare, planImport } from './share.js';
import { describeSlots } from './templates.js';
import { parseType } from './typekey.js';
import { TYPE_LABELS, MY } from './types.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SHOW = 200; // 語は先頭だけ見せる
// まだ保存していない自作テーマも含むので、app.js の typeText は使わず自前で（消えたテーマを外さない）
const label = type => parseType(type).map(k => (k.startsWith(MY) ? '★' + k.slice(MY.length) : TYPE_LABELS[k] ?? k)).join('＋');

export function initShareScreen({ store, isSpinning, themesChanged, templatesChanged }) {
  const dlg = document.getElementById('share'), body = dlg.querySelector('.body');
  let payload = null;

  const words = list => `<ul class="wg">${list.slice(0, SHOW).map(w => `<li><span>${esc(w)}</span></li>`).join('')}</ul>${list.length > SHOW ? `<p class="hint">ほか ${list.length - SHOW}語</p>` : ''}`;
  function preview() {
    const p = payload, renamed = planImport(p, store.state).renamed;
    const head = p.t === 'theme'
      ? `<h2>共有されたテーマ</h2>${p.themes.map(t => `<h3>テーマ「${esc(t.name)}」（${t.words.length}語）</h3>${words(t.words)}`).join('')}`
      : `<h2>共有されたテンプレート</h2><h3>${esc(p.template.name)}</h3><p>${esc(describeSlots(p.template.slots, label))}</p>`
        + (p.themes.length ? `<h3>いっしょに追加されるテーマ</h3><ul class="list">${p.themes.map(t => `<li><span>★${esc(t.name)}（${t.words.length}語）</span></li>`).join('')}</ul>` : '');
    body.innerHTML = `${head}${renamed.map(r => `<p class="hint">同じ名前があるので「${esc(r.to)}」として追加します</p>`).join('')}
      <div class="row"><button data-act="add">追加する</button><button data-act="cancel">やめる</button></div>
      <p class="err" role="alert"></p>`;
  }
  const done = isTheme => {
    body.innerHTML = `<p class="note" role="status">追加しました</p>${isTheme ? '<p class="hint">モニターを押してテーマを選ぶと使えます</p>' : ''}
      <div class="row"><button data-act="cancel">閉じる</button></div>`;
  };

  async function openHash() {
    const code = codeFromHash(location.hash);
    if (!code) return;
    payload = await decodeShare(code);
    document.querySelectorAll('dialog[open]').forEach(d => { if (d !== dlg) d.close(); }); // 開いている画面は、追加したものが映らなくなるので閉じる
    if (payload) preview();
    else body.innerHTML = '<p class="err" role="alert">共有リンクを読み込めませんでした</p><div class="row"><button data-act="cancel">閉じる</button></div>';
    if (!dlg.open) dlg.showModal();
  }

  dlg.querySelector('[data-close]').onclick = () => dlg.close();
  dlg.addEventListener('close', () => {
    payload = null;
    if (codeFromHash(location.hash)) history.replaceState(null, '', location.pathname + location.search); // リンクの # を外す（再読み込みで出直さない）
  });
  dlg.addEventListener('click', e => {
    const act = e.target.closest('button[data-act]')?.dataset.act;
    if (act === 'cancel') dlg.close();
    if (act !== 'add' || !payload) return;
    if (isSpinning()) { body.querySelector('.err').textContent = '回っている間は追加できません。止まってからもう一度押してください'; return; }
    const plan = planImport(payload, store.state), isTheme = payload.t === 'theme';
    if (plan.themes.length) { store.state.themes = [...store.state.themes, ...plan.themes]; store.save('themes'); themesChanged(); }
    if (plan.template) { store.state.templates = [...store.state.templates, plan.template]; store.save('templates'); templatesChanged(); }
    payload = null; // 二重に押しても足さない
    done(isTheme);
  });

  return { openHash };
}
