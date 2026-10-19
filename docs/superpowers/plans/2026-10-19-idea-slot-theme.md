# アイデアスロット テーマ機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 出てきた語をリールのテーマにして、その語に関係する語（WordNet の語のつながり）だけを流せるようにし、各リールの上にテーマ／種類を表示するモニターを付ける。

**Architecture:** `tools/build-graph.mjs` が WordNet から名詞のつながりデータ `data/graph.json` を作る。`src/theme.js`（DOM なし・テストあり）がそのデータからテーマの語を集める。アプリはテーマ中のリールの種類を `theme:<語>` にし、プールに同じキーでテーマの語を入れる（`pick.js` と `machine.js` は変えない）。筐体は縦に10伸ばしてモニターを置く。

**Tech Stack:** 既存どおり（素の ES modules、Node 24 `node:sqlite` / `node --test`）

**Spec:** `docs/superpowers/specs/2026-10-19-idea-slot-theme-design.md`（前提: `2026-10-16-idea-slot-casino-ui-design.md`）

## Global Constraints

- 依存パッケージなし・ビルドなし。相対パスのみ
- 筐体の論理サイズ 200×190。LEDバーより下（元の y ≥ 61）はすべて +10。モニターは y 62〜69（高さ8）、各リールの窓と同じ x・幅
- テーマ: D=3 から開始、20語未満なら D=4、5、それでも20語未満なら兄弟語を追加。分野の語（dmtc）は分野に着いた直後だけ拾い、そこからたどらない
- テーマの語から除く: 出発点の意味とその同義語、テーマの語そのもの、除外した語
- 語の絞り込みは `tools/categorize.mjs` の `keepLemma` と同じ、`_` は取り除く
- `data/graph.json` は 5MB 未満。アプリは最初にテーマを使うときだけ読み込む（保存済みテーマがあれば起動時）
- 保存: `settings.slots[i] = {type, theme?}`。テーマ中の種類キーは `'theme:' + 語`
- モニターの文字はスマホ幅 375px で 10px 以上、長い語は省略（…）
- 返す文言・掲示板の文は spec の表記どおり

## Review Focus

1. **テーマにできない語**（動詞・ジャンル・自分の語・つながりが無い語）を選ぶ → 掲示板で知らせて何も変えない（Task 2 のテスト＋Task 3）
2. **テーマの語をすべて除外する**（または除外でテーマの語が尽きる）→ そのリールは「語がありません」相当の表示で止まり、エラーにならない（Task 3）
3. **graph.json の読み込みに失敗する** → 掲示板で知らせ、テーマ無しのまま動き続ける（Task 3）
4. **保存済みのテーマがある状態で再読み込み** → グラフを読んでからテーマのプールを作り、最初の表示もテーマの語になる（Task 3）
5. **筐体を伸ばしたことで重ね物の位置がずれる**（窓・STOP・IDEA!・レバー・掲示板・語メニュー）→ 3枠・2枠・4枠、PC・375px で一致（Task 3 のブラウザ確認）

---

### Task 1: 語のつながりデータ（graph.json）

**Files:**
- Create: `tools/graph-encode.mjs`, `tools/build-graph.mjs`, `tests/graph-encode.test.mjs`, `data/graph.json`

**Interfaces:**
- Produces: `data/graph.json` = `{ v: 1, syn: string[][], hypo: number[], part: number[], memb: number[], subs: number[], inst: number[], dom: number[] }`
  - `syn[k]`: 名詞の意味 k の日本語の語（絞り込み後。無ければ `[]`）
  - `hypo`: `[親, 子, 親, 子, …]`（下位語）、`part`: `[全体, 部分, …]`（mprt）、`memb`: `[集合, 構成員, …]`（mmem）、`subs`: `[物, 素材, …]`（msub）、`inst`: `[種類, 実例, …]`、`dom`: `[語, 分野, …]`（dmnc）
- `tools/graph-encode.mjs`: `encodeGraph({synsets: Array<{id, lemmas: string[]}>, links: Array<{from, to, link}>}, keepLemma) → graph`（純粋関数。`link` は WordNet の名前 `hypo|mprt|mmem|msub|inst|dmnc`、それ以外は捨てる。両端が synsets に無いつながりも捨てる。語は `_` を取って keepLemma で絞り、意味の中で重複を除く）

- [ ] **Step 1: 失敗するテストを書く** — `tests/graph-encode.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeGraph } from '../tools/graph-encode.mjs';
import { keepLemma } from '../tools/categorize.mjs';
const synsets = [{ id: 'a-n', lemmas: ['宇宙', '大_宇宙'] }, { id: 'b-n', lemmas: ['銀河', 'ア'] }, { id: 'c-n', lemmas: [] }, { id: 'd-n', lemmas: ['天文学'] }];
const links = [
  { from: 'a-n', to: 'b-n', link: 'mmem' }, { from: 'a-n', to: 'c-n', link: 'hypo' },
  { from: 'b-n', to: 'd-n', link: 'dmnc' }, { from: 'a-n', to: 'zz-n', link: 'hypo' }, { from: 'a-n', to: 'b-n', link: 'sim' },
];
test('encodes lemmas, links and drops unknown', () => {
  const g = encodeGraph({ synsets, links }, keepLemma);
  assert.equal(g.v, 1);
  assert.deepEqual(g.syn, [['宇宙', '大宇宙'], ['銀河'], [], ['天文学']]);
  assert.deepEqual(g.memb, [0, 1]);
  assert.deepEqual(g.hypo, [0, 2]);
  assert.deepEqual(g.dom, [1, 3]);
  assert.deepEqual([g.part, g.subs, g.inst], [[], [], []]);
});
```

- [ ] **Step 2: 失敗を確認** — `npm test` / FAIL（モジュールなし）
- [ ] **Step 3: `tools/graph-encode.mjs` を実装**
- [ ] **Step 4: 通ることを確認** — `npm test` / PASS
- [ ] **Step 5: `tools/build-graph.mjs` を書いて実行**

`raw/wnjpn.db`（展開済み）を `node:sqlite` で開き、品詞 `n` の全 synset と、その日本語の語（`word.lang='jpn'` と `sense` の結合）、`synlink` の6種のつながりを読んで `encodeGraph` に渡し、`data/graph.json` に改行なしで書く。最後に意味の数・つながりの数・ファイルサイズを表示する。

Run: `node --no-warnings tools/build-graph.mjs`
Expected: 5MB 未満。「宇宙」を含む意味が2つ以上ある

- [ ] **Step 6: コミット** — `git commit -m "feat: build WordNet noun relation graph for themes"`

---

### Task 2: テーマの語を集める（純粋ロジック）

**Files:**
- Create: `src/theme.js`, `tests/theme.test.mjs`

**Interfaces:**
- Consumes: Task 1 の graph の形
- Produces:
  - `indexGraph(graph) → G`（下位方向の隣接・分野・分野の構成語・上位語・語→意味の索引を作る。1回だけ作って使い回す）
  - `themeWords(G, word, { min = 20, excluded = [] } = {}) → string[]`：spec の手順 1〜5。結果は重複なし、集めた順。テーマにできないときは `[]`

- [ ] **Step 1: 失敗するテストを書く** — `tests/theme.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexGraph, themeWords } from '../src/theme.js';
// 0 宇宙(同義:大宇宙) -memb-> 1 銀河 -hypo-> 2 渦巻銀河 -hypo-> 3 アンドロメダ -hypo-> 4 深い4 -hypo-> 5 深い5
// 1 銀河 -dom-> 6 天文学 ; 7 彗星 -dom-> 6 ; 7 -hypo-> 8 小彗星(分野の語からはたどらない)
// 9 自然物 -hypo-> 0 ; 9 -hypo-> 10 体(兄弟)
const graph = { v: 1,
  syn: [['宇宙', '大宇宙'], ['銀河'], ['渦巻銀河'], ['アンドロメダ'], ['深い4'], ['深い5'], ['天文学'], ['彗星'], ['小彗星'], ['自然物'], ['体']],
  hypo: [1, 2, 2, 3, 3, 4, 4, 5, 7, 8, 9, 0, 9, 10], part: [], memb: [0, 1], subs: [], inst: [], dom: [1, 6, 7, 6] };
const G = indexGraph(graph);

test('depth 3 with domain members, excluding start synonyms', () => {
  const w = themeWords(G, '宇宙', { min: 1 });
  assert.ok(w.includes('銀河') && w.includes('渦巻銀河') && w.includes('アンドロメダ'));
  assert.ok(w.includes('天文学') && w.includes('彗星'));
  assert.ok(!w.includes('小彗星'));          // 分野の語からはたどらない
  assert.ok(!w.includes('深い4'));            // D=3 で止まる
  assert.ok(!w.includes('宇宙') && !w.includes('大宇宙'));
  assert.ok(!w.includes('体'));               // 足りているので兄弟語なし
});
test('widens depth then adds siblings when below min', () => {
  const w = themeWords(G, '宇宙', { min: 100 });
  assert.ok(w.includes('深い4') && w.includes('深い5'));
  assert.ok(w.includes('体'));
});
test('excluded removed; unknown word gives []', () => {
  assert.ok(!themeWords(G, '宇宙', { min: 1, excluded: ['銀河'] }).includes('銀河'));
  assert.deepEqual(themeWords(G, '走る'), []);
});
test('no duplicates', () => {
  const w = themeWords(G, '宇宙', { min: 100 });
  assert.equal(new Set(w).size, w.length);
});
```

- [ ] **Step 2: 失敗を確認** — `npm test` / FAIL
- [ ] **Step 3: `src/theme.js` を実装**（幅優先。深さは「つながりを1本たどるごとに+1」。分野は「分野へ進む」で+1、「分野の語を拾う」で+1）
- [ ] **Step 4: 通ることを確認** — `npm test` / PASS
- [ ] **Step 5: 実データで確認** — `data/graph.json` を読む使い捨てスクリプトで「宇宙」「海」「学校」「魔法」「ドラゴン」の語数と先頭20語を表示し、レポートに書く（コミットしない）
- [ ] **Step 6: コミット** — `git commit -m "feat: collect theme words from relation graph"`

---

### Task 3: モニター・テーマ操作・保存（画面）

**Files:**
- Modify: `src/cabinet.js`, `src/reels.js`, `src/app.js`, `src/layout.js`, `index.html`（canvas の高さ）, `style.css`, `tests/store.test.mjs`
- Possibly modify: `src/store.js`（slot の `theme` を通す。今は slots の中身を検証していないので通るはず。テストで確かめる）

**Interfaces:**
- Consumes: `indexGraph`, `themeWords`（Task 2）、`data/graph.json`（Task 1）

- [ ] **Step 1: 失敗するテストを足す** — `tests/store.test.mjs`

```js
test('slot theme survives load and export/import', () => {
  const st = mem({ 'slot.settings': JSON.stringify({ count: 1, slots: [{ type: 'any', theme: '宇宙' }], autoStop: false, sound: true, reduceMotion: false }) });
  const s = createStore(st);
  assert.deepEqual(s.state.settings.slots, [{ type: 'any', theme: '宇宙' }]);
  const b = createStore(mem());
  assert.deepEqual(b.importJSON(s.exportJSON()), { ok: true });
  assert.deepEqual(b.state.settings.slots, [{ type: 'any', theme: '宇宙' }]);
});
```

- [ ] **Step 2: 通るか確認し、通らなければ store を直す**
- [ ] **Step 3: 筐体を 200×190 にしてモニターを置く**

- `src/cabinet.js`：`H = 190`。元の y ≥ 61 の描画をすべて +10 する（定数 `DY = 10` を使う）。対象はリール枠・窓・ペイライン・IDEA!・操作台・台座・コイン受け皿・コイン・レバーの台座。看板・LEDバー・回転灯・レバーの玉の上端は動かさない。本体の箱とカーペットは高さに合わせて伸ばす
- y 61〜70 に、各リールのモニター枠（窓と同じ x・幅、y 62、高さ 8）を描く。暗い緑の液晶の地に黒い縁を付ける。文字は描かない（HTML）
- `src/layout.js` に `MONITOR_Y = 62`、`MONITOR_H = 8`、`REEL_Y = 79`、`REEL_H = 48` を足し、重ね物はこれを使う
- `src/reels.js`：位置の換算を 190 基準に直す（`top: y/1.9%`, `height: h/1.9%`）。窓・STOP・IDEA!・語メニューを +10。掲示板とレバーは動かさない。各リールにモニター `<div class="mon">` を置き、`setMonitor(i, text, themed)` を足す（テーマ中は金色・先頭に★）
- `index.html`：canvas を `height="190"` にする

- [ ] **Step 4: テーマの操作を入れる**（`src/app.js`）

- 語メニュー：テーマ無しのリールなら「この語をテーマに」、テーマ中なら「テーマ解除」を足す（`reels.js` の `showMenu(i, {themed})`）
- 「この語をテーマに」の流れ：
  1. グラフをまだ読んでいなければ、掲示板に「テーマを準備中…」と出して `data/graph.json` を読み、`indexGraph` する（Promise を1つだけ持つ）
  2. 読み込みに失敗したら、掲示板で知らせて終わる
  3. `themeWords(G, 語, {excluded})` を求める
  4. `[]` なら「「〇〇」はテーマにできない語です」と `deny` を出して終わる
  5. 語のリストをキャッシュする（`themes[語]`）
  6. `pools['theme:'+語]` を作る
  7. そのリールを `{...r, type: 'theme:'+語, base: 元の type, held: false}` にする
  8. 設定を保存し、掲示板に「★ N番リールのテーマ：〇〇（M語）」を出す
- 「テーマ解除」：`type = base` に戻して保存し、掲示板に「N番リールのテーマを解除」
- `rebuildPools` のあと、キャッシュ済みのすべてのテーマのプールを、除外した語を除いて作り直す
- `saveSettings`：`{type: r.base ?? r.type, theme?}` で保存する
- 起動時：保存した slot に theme があれば、グラフを読んでからテーマのプールを作り、最初の `spin` をする。グラフが読めなければテーマを外して起動し、掲示板で知らせる
- リール設定で種類を変えたらテーマを外す。リール設定の select には `base` を表示する
- モニター：状態が変わるたびに `setMonitor(i, テーマ中なら語、そうでなければ TYPE_LABELS[type])` を呼ぶ
- 検索の索引（`buildIndex`）は、`theme:` のキーを含めない（今のままで含まれないことを確認する）

- [ ] **Step 5: `style.css`** — `.mon`：緑の液晶の文字（`#5dff8a`）、テーマ中は金（`#ffe066`）。文字サイズは `max(calc(var(--u)*4.2), 10px)`、1行で収まらなければ省略（…）。リール中段などの既存の文字サイズの規則は変えない
- [ ] **Step 6: ブラウザで確認**（新しいオリジンを使う。`python -m http.server 8126` と http://127.0.0.1:8126/ 。ほかのオリジンの保存データには触れない）

確認すること：
- 3枠・2枠・4枠で、窓・STOP・IDEA!・レバー・掲示板・語メニュー・モニターの位置が筐体の絵と合う（PC 幅と 375px）
- 「宇宙」を出すか語えらびで固定し、ロックを外してから語メニューで「この語をテーマに」→ モニターが「★宇宙」になる → 回すと宇宙の語が流れる・止まる
- テーマ解除で元の種類に戻る
- 再読み込みしてもテーマが残る
- 動詞をテーマにしようとすると「テーマにできない語です」が出る
- 375px でモニターの文字が 10px 以上
- コンソールにエラーが無い
- スクリーンショット（PC 幅と 375px）

- [ ] **Step 7: `npm test` を通してコミット** — `git commit -m "feat: add reel themes with monitors"`
