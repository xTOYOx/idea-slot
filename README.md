# アイデアスロット

ランダムな単語・動詞・ゲームジャンル・タグを 2〜4 枠のリールで組み合わせて、ゲームやアプリのアイデアの種を出すツールです。依存なしの静的Webアプリ。

公開URL: https://toyogame.github.io/idea-slot/ （公開用リポジトリ toyogame/idea-slot。反映は `node tools/publish.mjs`）

## 使い方

- 画面いっぱいの筐体。レバー（またはスペースキー、スマホは下の大きな SPIN ボタン）でリールを回す。各リールの STOP（または数字キー 1〜4）で止め、止まった枠の LOCK を押すとその語が固定される
- 筐体の左にある ＋ / － でリールの数（2〜4）を変える
- 各リール上の緑のモニターを押すと、そのリールの種類をえらべる。チェック式で複数の種類（自作テーマも）を混ぜられる。先頭の「語をえらぶ…」で語を指定（検索または自由入力）
- いいね！と思った組み合わせは IDEA! ボタン（Enterキー）で当たり帳に保存。メモも書ける
- 止まっている窓の語をクリック（タップ）すると、その語をクリップボードにコピーする（調べもの用）。マウスを乗せる（スマホは長押し）と語の意味が出る
- 左上の ⏸（または Esc）でポーズメニュー。自動STOP・音・演出を減らす、テーマ、自分の語、書き出し/読み込みがここにある
- 当たり帳は画面の右端、履歴は左端のタブ（キーは B / H）から引き出す。スマホの縦画面は、SPIN の下に常に出るタブ付きの一覧（履歴・当たり帳・テンプレ）に切り替わる

## 開発

```
python -m http.server 8123   # http://localhost:8123/ で確認
npm test                     # テスト
```

語データの再生成: [bond-lab/wnja v1.1](https://github.com/bond-lab/wnja) の `wnjpn.db.gz` を `raw/` にダウンロードし、`node --no-warnings tools/build-words.mjs` を実行します。語の意味（`data/defs/`）は `node --no-warnings tools/build-defs.mjs`、テーマ集は `node tools/build-extra.mjs` で作り直せます。続けてテーマ用の `data/graph.json` を作るには、リポジトリのルートで `node --no-warnings tools/build-graph.mjs` を実行します。

## データの出典

語データの出典とライセンスは [LICENSE-DATA.md](LICENSE-DATA.md) を参照してください。

画面のフォント DotGothic16 は [Google Fonts](https://github.com/google/fonts/tree/main/ofl/dotgothic16) から取得し、SIL Open Font License 1.1 のもとで `fonts/` に同梱しています（ライセンス文は [fonts/OFL.txt](fonts/OFL.txt)）。
