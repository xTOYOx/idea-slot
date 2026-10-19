# アイデアスロット

ランダムな単語・動詞・ゲームジャンル・タグを 2〜4 枠のリールで組み合わせて、ゲームやアプリのアイデアの種を出すツールです。依存なしの静的Webアプリ。

公開URL: https://toyogame.github.io/idea-slot/ （公開用リポジトリ toyogame/idea-slot。反映は `node tools/publish.mjs`）

## 使い方

- レバー（またはスペースキー、スマホは SPIN）でリールを回す。各リールの STOP（または数字キー 1〜4）で止め、止まった枠の LOCK を押すとその語が固定される
- 「手動/自動STOP」で自動停止、「リール設定」で枠の数（2〜4）・各枠の種類・語の指定（検索または自由入力）を変えられる
- いいね！と思った組み合わせは IDEA! ボタン（Enterキー）で当たり帳に保存。メモも書ける
- 語をタップすると「除外」または「その枠だけ振り直し」ができる
- 「メニュー」から自分の語の追加、設定（演出を減らす・書き出し/読み込み）が開ける

## 開発

```
python -m http.server 8123   # http://localhost:8123/ で確認
npm test                     # テスト
```

語データの再生成: [bond-lab/wnja v1.1](https://github.com/bond-lab/wnja) の `wnjpn.db.gz` を `raw/` にダウンロードし、`node --no-warnings tools/build-words.mjs` を実行します。続けてテーマ用の `data/graph.json` を作るには、リポジトリのルートで `node --no-warnings tools/build-graph.mjs` を実行します。

## データの出典

語データの出典とライセンスは [LICENSE-DATA.md](LICENSE-DATA.md) を参照してください。

画面のフォント DotGothic16 は [Google Fonts](https://github.com/google/fonts/tree/main/ofl/dotgothic16) から取得し、SIL Open Font License 1.1 のもとで `fonts/` に同梱しています（ライセンス文は [fonts/OFL.txt](fonts/OFL.txt)）。
