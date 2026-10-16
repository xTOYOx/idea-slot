# アイデアスロット v2 カジノ筐体UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v1 の画面を、ドット絵のカジノ筐体（レバー・STOP/LOCK・IDEA!ボタン・当たり帳）に作り直す。

**Architecture:** 状態遷移（回す・止める・ロック・保存可否）と検索・リール配置は DOM に依存しない純粋なモジュールにし、`node --test` で検証する。筐体のドット絵は `src/cabinet.js`（canvas）、効果音は `src/sound.js`（Web Audio）に分ける。`src/app.js` はそれらと既存の `pick.js` `pools.js` `store.js` をつないで画面を組み立てる。

**Tech Stack:** HTML / CSS / ES modules（依存なし・ビルドなし）、canvas 2D、Web Audio API、Node 24 `node --test`

**Spec:** `docs/superpowers/specs/2026-10-16-idea-slot-casino-ui-design.md`（見た目の基準: `docs/superpowers/specs/mockups/casino-v6.html`）。v1 の spec `2026-10-16-idea-slot-design.md` も前提として有効。

## Global Constraints

- 依存パッケージなし・ビルド工程なし。相対パスのみ（GitHub Pages の `/idea-slot/` 配下で動く）
- 筐体は論理 200×180 ピクセルの canvas を `image-rendering: pixelated` で拡大。HTML の重ね物は論理座標から % で配置し、1論理ピクセル＝CSS変数 `--u`
- 枠の数 2〜4。履歴は直近100件。保存の読み書きは try/catch、壊れていたら初期値
- 語は v1 の `pick.js` の `spin` / `rerollOne` で選ぶ（`held` がロック。「全部ランダム」は4グループ均等）
- 自動STOPの停止時刻: 回し始めから `600 + 320 × リール番号(0始まり)` ms
- 当たり演出 約3.2秒。ランダムな大当たりは無い
- 文字フォント DotGothic16（OFL）を `fonts/` に同梱、ライセンス文 `fonts/OFL.txt`。失敗時は monospace
- スマホ幅 375px で横スクロールなし、リール中段の文字 12px 以上、STOP/LOCK・IDEA!・レバーの当たり判定は 40px 以上
- `prefers-reduced-motion` または設定「演出を減らす」で、電球の流れ・光沢・回転灯・コイン粒・リールの弾みを止める
- localStorage キー: v1 の5つ＋ `slot.stats`

## Review Focus

1. **STOP を連打すると、止まった直後の2回目のタップで LOCK されてしまう** → 止まってから 300ms はそのボタンを押しても何もしない（Task 2 のテスト）
2. **回転中にリール設定（枠の数・種類・語をえらぶ）や当たり帳の「枠に戻す」を操作する** → 回転中は無視する（Task 2 の `canEdit` のテスト＋Task 4 で各操作に適用）
3. **ボタンにフォーカスがある状態で Enter を押す** → ボタンのクリックと IDEA! 保存が二重に起きない。Enter/スペースは、フォーカスがボタン・入力欄・select・dialog に無いときだけ筐体の操作にする（Task 4 のブラウザ確認）
4. **ロック中の語を「この語を除外」する** → ロックを外し、その枠を振り直す（Task 2 の `excludeAt` のテスト）
5. **v1 の保存データ（`animate` だけの settings、`stats` なし、書き出し version 1）を読み込む** → 移行して動く（Task 1 のテスト）

---

### Task 1: 保存の拡張（settings 移行・stats・書き出し v2）

**Files:**
- Modify: `src/store.js`, `tests/store.test.mjs`

**Interfaces:**
- Produces:
  - `state.settings = {count, slots:[{type}], autoStop:false, sound:true, reduceMotion:false}`（初期値）
  - `state.stats = {spins: 0}`、キー `slot.stats`
  - `store.countSpin()`：`stats.spins` を1増やして保存
  - `exportJSON()` は `version: 2`。`importJSON` は version 1（stats なし・animate あり）も受け付ける

- [ ] **Step 1: 失敗するテストを追加する**（既存テストの `settings.animate` 前提は新しい形に直す）

```js
test('v1 settings with animate migrate to reduceMotion', () => {
  const s = createStore(mem({ 'slot.settings': JSON.stringify({ count: 2, slots: [{ type: 'verb' }, { type: 'any' }], animate: false }) }));
  assert.deepEqual(s.state.settings, { count: 2, slots: [{ type: 'verb' }, { type: 'any' }], autoStop: false, sound: true, reduceMotion: true });
});
test('defaults include stats and new settings', () => {
  const s = createStore(mem());
  assert.deepEqual(s.state.stats, { spins: 0 });
  assert.equal(s.state.settings.autoStop, false);
  assert.equal(s.state.settings.sound, true);
  assert.equal(s.state.settings.reduceMotion, false);
});
test('countSpin persists', () => {
  const st = mem(); const s = createStore(st);
  s.countSpin(); s.countSpin();
  assert.deepEqual(JSON.parse(st.m['slot.stats']), { spins: 2 });
});
test('export is version 2 and includes stats', () => {
  const s = createStore(mem()); s.countSpin();
  const d = JSON.parse(s.exportJSON());
  assert.equal(d.version, 2);
  assert.deepEqual(d.stats, { spins: 1 });
});
test('version 1 export imports (no stats, animate)', () => {
  const v1 = { app: 'idea-slot', version: 1, settings: { count: 3, slots: [{ type: 'any' }, { type: 'any' }, { type: 'any' }], animate: true }, history: [], favorites: [], custom: {}, excluded: ['猫'] };
  const s = createStore(mem());
  assert.deepEqual(s.importJSON(JSON.stringify(v1)), { ok: true });
  assert.deepEqual(s.state.excluded, ['猫']);
  assert.equal(s.state.settings.reduceMotion, false);
  assert.deepEqual(s.state.stats, { spins: 0 });
});
```

- [ ] **Step 2: 失敗を確認する** — Run: `npm test` / Expected: 上の5件が FAIL
- [ ] **Step 3: 実装する** — settings の読み込みと import で `normalizeSettings(v) → settings | null` を通す（新しい形はそのまま、`animate` だけある古い形は `reduceMotion = !animate` に移し、足りない真偽値は初期値で埋める。count が数値でない・slots が配列でないなら null）。`stats` は `{spins: 整数≥0}` を検証。import では `stats` が無ければ初期値
- [ ] **Step 4: 通ることを確認する** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: コミット** — `git commit -m "feat: extend store with v2 settings, stats and export v2"`

---

### Task 2: 筐体の状態遷移（純粋ロジック）

**Files:**
- Create: `src/machine.js`, `tests/machine.test.mjs`

**Interfaces:**
- Consumes: `spin`, `rerollOne`（`src/pick.js`）
- Produces（`Reel = {type, value, held, running?, target?, stoppedAt?}`。全関数は新しい配列を返し、引数を変えない）:
  - `startSpin(reels, pools, rng = Math.random) → {ok:true, reels} | {ok:false, reason:'spinning'|'allLocked'}`：ロックしていないリールを `running:true` にし、`spin()` の結果を `target` に入れる（`value` は止まるまで前の値のまま）
  - `stopReel(reels, i, now) → reels`：回っていれば `value = target`、`running:false`、`stoppedAt: now`。回っていなければそのまま
  - `stopAll(reels, now) → reels`
  - `pressReel(reels, i, now) → {reels, action:'stop'|'lock'|'unlock'|'ignored'}`：回転中なら stop。止まって 300ms 未満なら ignored。それ以外はロックを切り替える
  - `isSpinning(reels) → boolean`、`allStopped(reels) → boolean`（どれも回っていない）
  - `canSave(reels, favorites) → 'ok'|'spinning'|'empty'|'saved'`（`favorites` は `{combo}` の配列。combo の比較は配列の要素一致）
  - `canEdit(reels) → boolean`（回っていなければ true）
  - `autoStopDelays(reels) → Array<number|null>`：回っているリールに `600 + 320 × i`、それ以外は null
  - `excludeAt(reels, i, pools, rng) → reels`：`held:false` にして `rerollOne`
  - `restore(reels, combo) → reels`：枠の数を combo に合わせ、値を入れ、全部 `held:false, running:false`

- [ ] **Step 1: 失敗するテストを書く** — `tests/machine.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/machine.js';
const pools = { a: ['x', 'y', 'z', 'w'] };
const R = (value, held = false) => ({ type: 'a', value, held });

test('startSpin runs only unlocked reels and sets targets', () => {
  const r = M.startSpin([R('x', true), R('y'), R('z')], pools);
  assert.equal(r.ok, true);
  assert.deepEqual(r.reels.map(x => !!x.running), [false, true, true]);
  assert.equal(r.reels[1].value, 'y');               // unchanged until stop
  assert.ok(r.reels[1].target && r.reels[2].target);
  assert.notEqual(r.reels[1].target, 'x');           // no duplicate with locked word
});
test('startSpin refuses when all locked or already spinning', () => {
  assert.deepEqual(M.startSpin([R('x', true), R('y', true)], pools), { ok: false, reason: 'allLocked' });
  const { reels } = M.startSpin([R('x'), R('y')], pools);
  assert.deepEqual(M.startSpin(reels, pools), { ok: false, reason: 'spinning' });
});
test('stopReel reveals target', () => {
  const { reels } = M.startSpin([R('x'), R('y')], pools);
  const s = M.stopReel(reels, 0, 1000);
  assert.equal(s[0].value, reels[0].target);
  assert.equal(s[0].running, false);
  assert.equal(s[1].running, true);
});
test('pressReel: stop, then ignored within 300ms, then lock/unlock', () => {
  let { reels } = M.startSpin([R('x'), R('y')], pools);
  let p = M.pressReel(reels, 0, 1000); assert.equal(p.action, 'stop');
  p = M.pressReel(p.reels, 0, 1200); assert.equal(p.action, 'ignored');
  p = M.pressReel(p.reels, 0, 1400); assert.equal(p.action, 'lock'); assert.equal(p.reels[0].held, true);
  p = M.pressReel(p.reels, 0, 1500); assert.equal(p.action, 'unlock'); assert.equal(p.reels[0].held, false);
});
test('canSave states', () => {
  const stopped = [R('x'), R('y')];
  assert.equal(M.canSave(stopped, []), 'ok');
  assert.equal(M.canSave(stopped, [{ combo: ['x', 'y'] }]), 'saved');
  assert.equal(M.canSave([R('x'), R(null)], []), 'empty');
  assert.equal(M.canSave(M.startSpin(stopped, pools).reels, []), 'spinning');
});
test('canEdit false while spinning', () => {
  assert.equal(M.canEdit([R('x')]), true);
  assert.equal(M.canEdit(M.startSpin([R('x')], pools).reels), false);
});
test('autoStopDelays', () => {
  const { reels } = M.startSpin([R('x'), R('y', true), R('z')], pools);
  assert.deepEqual(M.autoStopDelays(reels), [600, null, 1240]);
});
test('excludeAt unlocks and rerolls', () => {
  const out = M.excludeAt([R('x', true), R('y')], 0, { a: ['z'] });
  assert.deepEqual(out[0], { type: 'a', value: 'z', held: false });
});
test('restore resizes and clears locks', () => {
  const out = M.restore([R('x', true), R('y', true), R('z')], ['p', 'q']);
  assert.deepEqual(out.map(r => [r.value, r.held, !!r.running]), [['p', false, false], ['q', false, false]]);
});
test('pure: inputs not mutated', () => {
  const inp = [R('x'), R('y')]; const copy = structuredClone(inp);
  M.startSpin(inp, pools); M.pressReel(inp, 0, 0); M.restore(inp, ['a']);
  assert.deepEqual(inp, copy);
});
```

- [ ] **Step 2: 失敗を確認する** — Run: `npm test` / Expected: FAIL（モジュールなし）
- [ ] **Step 3: `src/machine.js` を実装する**（`restore` で枠を増やすときは `resizeSlots` と同じく type `'any'`。300ms は `LOCK_GUARD_MS` 定数）
- [ ] **Step 4: 通ることを確認する** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: コミット** — `git commit -m "feat: add slot machine state transitions"`

---

### Task 3: 語の検索とリール配置（純粋ロジック）

**Files:**
- Create: `src/search.js`, `src/layout.js`, `tests/search.test.mjs`, `tests/layout.test.mjs`

**Interfaces:**
- Consumes: `buildPools` の結果、`TYPE_LABELS`
- Produces:
  - `buildIndex(pools, labels) → Array<{w, label}>`：`noun:*` の12小分類・`verb`・`genre`・`tag:*` の3小分類から作る（和集合キー `noun` `tag` `any` は使わない）。同じ語が複数の種類にあるときは最初の1件だけ
  - `searchWords(index, q, limit = 50) → Array<{w, label}>`：`q` を前後空白除去。空なら `[]`。完全一致 → 前方一致 → 部分一致の順で、`limit` 件まで。正規表現を使わない（`includes` / `startsWith`）
  - `reelRects(n) → Array<{x, w}>`（論理座標、n=2〜4）：領域 x=33〜167（幅134）、間隔7、幅 `floor((134 − 7(n−1)) / n)`、全体を領域の中央に寄せる。窓の y=69、高さ48は固定（呼ぶ側の定数）
  - `stopRect({x, w}) → {x, w}`：ボタン台座。幅 `min(28, w)`、窓の中央に揃える

- [ ] **Step 1: 失敗するテストを書く**

`tests/search.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, searchWords } from '../src/search.js';
const pools = { 'noun:animal': ['ネコ', 'ネコザメ', 'コネコ'], verb: ['寝転ぶ'], genre: ['ネコ'], 'tag:look': ['8ビット'], noun: ['ネコ'], tag: ['8ビット'], any: ['ネコ'] };
const labels = { 'noun:animal': '動物', verb: '動詞', genre: 'ゲームジャンル', 'tag:look': 'タグ：見た目' };
test('index skips union keys and dedupes', () => {
  const ix = buildIndex(pools, labels);
  assert.equal(ix.filter(x => x.w === 'ネコ').length, 1);
  assert.deepEqual(ix.find(x => x.w === '8ビット'), { w: '8ビット', label: 'タグ：見た目' });
});
test('exact, prefix, then contains; limit; empty', () => {
  const ix = buildIndex(pools, labels);
  assert.deepEqual(searchWords(ix, ' ネコ ').map(x => x.w), ['ネコ', 'ネコザメ', 'コネコ']);
  assert.equal(searchWords(ix, 'ネコ', 2).length, 2);
  assert.deepEqual(searchWords(ix, '  '), []);
  assert.deepEqual(searchWords(ix, '.*'), []);
});
```

`tests/layout.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reelRects, stopRect } from '../src/layout.js';
test('3 reels match mockup', () => assert.deepEqual(reelRects(3), [{ x: 33, w: 40 }, { x: 80, w: 40 }, { x: 127, w: 40 }]));
test('2 and 4 reels fit inside 33..167 with gap 7', () => {
  for (const n of [2, 4]) {
    const r = reelRects(n);
    assert.equal(r.length, n);
    assert.ok(r[0].x >= 33 && r.at(-1).x + r.at(-1).w <= 167);
    for (let i = 1; i < n; i++) assert.equal(r[i].x - (r[i - 1].x + r[i - 1].w), 7);
  }
});
test('stopRect centered, max 28', () => {
  assert.deepEqual(stopRect({ x: 33, w: 40 }), { x: 39, w: 28 });
  assert.deepEqual(stopRect({ x: 33, w: 28 }), { x: 33, w: 28 });
});
```

- [ ] **Step 2: 失敗を確認する** — Run: `npm test` / Expected: FAIL
- [ ] **Step 3: 実装する**
- [ ] **Step 4: 通ることを確認する** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: コミット** — `git commit -m "feat: add word search and reel layout helpers"`

---

### Task 4: 筐体の描画と効果音

**Files:**
- Create: `src/cabinet.js`, `src/sound.js`

**Interfaces:**
- Consumes: `reelRects`, `stopRect`（Task 3）
- Produces:
  - `createCabinet(canvas) → Cabinet`
    - `cab.setReels(n)`：静的レイヤーを描き直す（窓・ペイラインの印・台座・番号札をリール数に合わせる）
    - `cab.update(view)`：`view = {spinning, canSave:'ok'|'spinning'|'empty'|'saved', ideas, hits, reduceMotion}`。毎フレームの描画はこの最新値を使う
    - `cab.pullLever()`：レバーを 220ms 下げる
    - `cab.celebrate()`：当たり演出を 3200ms（回転灯・虹色の電球・コインのシャワー48枚）。`reduceMotion` 中は IDEA! の虹色だけ
    - `cab.dribble()`：停止時のコイン5枚（`reduceMotion` 中は何もしない）
    - `cab.pressIdea()`：IDEA! ボタンを 120ms 押し下げて見せる
    - `cab.celebrating() → boolean`
  - `createSound() → {enabled: boolean, play(name)}`。`name`: `lever` `tick` `stop` `lock` `unlock` `chime` `jackpot` `deny`。`enabled` が false なら何もしない。AudioContext は最初の `play` で作る。作れない環境では何もしない

- [ ] **Step 1: `src/cabinet.js` を書く**

モックアップ `docs/superpowers/specs/mockups/casino-v6.html` の描画（`drawStatic` `frame` `bulbs` `big` `tiny` `led` の各スプライトと色）を移植する。リールの窓は `reelRects(n)` で、台座は `stopRect` で配置する。窓の間のペイラインの印も、隙間ごとに描く。電球の流れの速さ: 通常150ms、回転中70ms、演出中50ms ごとに1コマ。`reduceMotion` のときは、電球を固定の点灯にし、光沢と回転灯を止め、コイン粒を出さない。rAF ループは1本だけにする。

- [ ] **Step 2: `src/sound.js` を書く**

各音の周波数と長さは、モックアップの `beep` と `sweep` の呼び出しをそのまま使う。対応は `lever` / `tick` / `stop` / `lock` / `unlock` / `chime`（全部停止時）/ `jackpot`（サイレン2回＋ファンファーレ＋コイン音）/ `deny`（低い音）。

- [ ] **Step 3: ブラウザで単体確認する**（スクラッチの確認用 HTML で `createCabinet` を呼ぶ。コミットしない）

確認すること：
- 3枠でモックアップと同じ見た目になる。2枠・4枠で窓と台座が等間隔に並ぶ
- `update({canSave:'ok'})` で IDEA! が点滅する。`'saved'` で SAVED になる
- `celebrate()` で演出が出て、約3.2秒で戻る
- `reduceMotion:true` で電球が流れない
- コンソールにエラーが無い

- [ ] **Step 4: コミット** — `git commit -m "feat: add pixel-art cabinet renderer and sound effects"`

---

### Task 5: 画面の組み立て（フォント・筐体・操作・パネル）

**Files:**
- Create: `fonts/DotGothic16-Regular.ttf`, `fonts/OFL.txt`
- Modify: `index.html`, `style.css`, `src/app.js`, `src/screens.js`, `README.md`

**Interfaces:**
- Consumes: Task 1〜4 のすべて、既存の `buildPools` `TYPE_LABELS` `TYPE_KEYS`
- Produces: 完成した画面

- [ ] **Step 1: フォントを入れる**（ダウンロードなので、ユーザーの許可を取ってから）

`https://github.com/google/fonts/tree/main/ofl/dotgothic16` の `DotGothic16-Regular.ttf` と `OFL.txt` を `fonts/` に置く。`style.css` に `@font-face { font-family: 'DotGothic16'; src: url('fonts/DotGothic16-Regular.ttf'); font-display: swap; }` を書く。README の出典欄に追記する。

- [ ] **Step 2: `index.html` を組み直す**

上から次の順に並べる。
- 筐体の `<canvas width="200" height="180">` と、重ね物を入れる箱
- チップボタン列：全部STOP / 手動・自動STOP / リール設定 / 音 / メニュー / SPIN（SPIN は幅 600px 未満だけ表示）
- `#setup` リール設定（枠の数 2〜4 と、各リールの種類 select と「語をえらぶ」）
- `#pick` 語えらび（検索欄とカード）
- `#hits` 当たり帳
- `<details>` の履歴

`#custom` と `#settings` の dialog は残す。`#favorites` の dialog と、ヘッダーの nav は消す。

- [ ] **Step 3: `src/app.js` を書き直す**

- 状態は `reels`（Task 2 の Reel）にまとめる。読み込み時は v1 と同じく、`settings.slots` → reels、count の clamp、未知の種類は `'any'`、最初に1回 `spin`（履歴には入れない）
- リールの HTML は `.strip` に4段。回転中は `.spin` を付け、120ms ごとに表示の語を入れ替える（前後の段の語は、その種類のプールから選ぶ）。止まったら `.bn` を付ける。ロック中の窓は `.lk`
- レバー・スペース（`startSpin`）。成功したら次を行う
  - `cab.pullLever()`、`sound.play('lever')`
  - 自動STOPなら `autoStopDelays` で予約する
  - 回転中は `tick` を鳴らす
- リールのボタン・数字キー 1〜4（`pressReel`）
  - action に応じて音を鳴らし、掲示板を更新し、ボタンの表示を STOP / LOCK / LOCKED に変える
  - 全部止まったら次を行う：`store.pushHistory`、`store.countSpin()`、`chime`、`cab.dribble()`
- IDEA! ボタン・Enter（`canSave`）
  - `'ok'` のとき：当たり帳の先頭に `{combo, memo:'', savedAt}` を足して保存する。`cab.celebrate()`、`sound.play('jackpot')`、掲示板を更新する。新しいカードのメモ欄にフォーカスする（`preventScroll`）
  - `'saved'` のとき：掲示板に「保存ずみ」と出し、`deny` を鳴らす
  - それ以外は `deny` だけ
- 掲示板の文言は spec の表のとおりにする
- 回っていない窓の語をタップ → メニュー（「この語を除外」は `excludeAt`、「この枠だけ振り直す」は `rerollOne`）
- リール設定・語えらび・当たり帳の「枠に戻す」は `canEdit` が false の間は無視する
  - 種類の変更：`setSlotType` してから `rerollOne`（ロック中なら、ロックは外れる）
  - 語えらび：`searchWords(buildIndex(...), q)` の結果に加えて、先頭に「いま出ている語」、末尾に「自由入力で固定」を出す。選ぶと値が入り、ロックされる
- キー操作は、フォーカスがボタン・入力欄・select・textarea・dialog の中に無いときだけ受け付ける。`e.repeat` は無視する
- `cab.update` は状態が変わるたびに呼ぶ（ideas＝`stats.spins`、hits＝当たり帳の件数）
- `sound.enabled = settings.sound`。チップで切り替えて保存する。自動STOP も同様
- `reduceMotion` は「設定またはOSの `prefers-reduced-motion`」で決める。リールの `.bn` も付けない
- データ読み込みの失敗表示は v1 と同じ

- [ ] **Step 4: `src/screens.js` を直す**

- favorites のビューと処理を消す（当たり帳は app.js 側）
- settings の「演出」チェックを「演出を減らす（`reduceMotion`）」に変える。変更したら app に知らせる（ctx に `onSettingsChange` を足す）
- `[data-open]` の開くボタンは「メニュー」チップから開くようにする（メニュー → 小さな選択：自分の語 / 設定）
- 当たり帳のカード（app.js）にも「枠に戻す」「削除」を付ける

- [ ] **Step 5: `style.css` を書き直す**

モックアップの CSS を土台にする。ページの背景は濃い色（`#1b0b14`）。スマホ対応は次のとおり。
- 中段の文字は `max(calc(var(--u)*5.2), 12px)` で、2行まで（`-webkit-line-clamp: 2`）
- STOP/LOCK・IDEA!・レバーは、`::before` で上下に当たり判定を広げて 40px 以上にする
- チップは折り返して並べる
- 左右の余白は 16px

- [ ] **Step 6: ブラウザで確認する**

`preview_start {name:"idea-slot"}`（ポート 8123）を使う。確認すること：
- 3枠で回す → 各 STOP → LOCK → もう一度回す（ロックした枠が動かない）
- STOP を素早く2回押しても LOCK されない
- 全部ロックで回そうとすると掲示板に出る
- IDEA! で当たり帳に入り、演出が出る。もう一度押すと「保存ずみ」。再読み込みしても当たり帳とメモが残る
- 自動STOP で左から順に止まる
- 回転中のリール設定と「枠に戻す」が効かない
- リール設定で2枠・4枠にする。種類を変えると、その枠だけ振り直される
- 語えらびで検索結果が出て、自由入力で固定できる
- 窓の語をタップして除外すると、その語は二度と出ない
- ボタンにフォーカスがある状態で Enter を押しても、二重に保存されない
- 音 OFF で鳴らない。「演出を減らす」で電球が止まる
- 375×667 で次を確かめる：横スクロールなし、中段の文字 ≥12px（`getComputedStyle` で確認）、STOP の当たり判定 ≥40px（`getBoundingClientRect`）
- コンソールにエラーが無い
- スクリーンショット（PC 幅と 375px）

- [ ] **Step 7: テストを通してコミットする** — Run: `npm test` / Expected: PASS。`git commit -m "feat: rebuild UI as pixel-art casino cabinet"`

---

### Task 6: 公開

- [ ] **Step 1: ユーザーに確認する** — 公開先（今の xtoyox.github.io/idea-slot か、別アカウントか）と、master への取り込みの可否
- [ ] **Step 2: 了承後** — `feat/casino-ui` を master に `--no-ff` でマージして push する。公開先が別アカウントなら、その手順（別途決める）に従う
- [ ] **Step 3: 公開URLで確認する** — 回して止め、IDEA! で保存できること。375px でも確認する
