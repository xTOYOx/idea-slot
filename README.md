# アイデアスロット

ランダムな単語・動詞・ゲームジャンル・タグを 2〜4 枠のリールで組み合わせて、ゲームやアプリのアイデアの種を出すツールです。依存なしの静的Webアプリ。

公開URL: https://xtoyox.github.io/idea-slot/

## 使い方

- 枠の数（2〜4）と、各枠の種類（単語・動詞・ジャンル・タグ）を選ぶ
- 「かけ合わせる」ボタン（またはスペースキー）でリールを回す
- HOLD した枠は固定されたまま、他の枠だけ回る
- 語をタップすると「除外」または「振り直し」ができる
- ☆ で気に入った組み合わせを保存できる
- 「自分の語」で独自の語を追加できる
- 設定の書き出し・読み込みで PC とスマホの間で設定を移行できる

## 開発

```
python -m http.server 8123   # http://localhost:8123/ で確認
npm test                     # テスト
```

語データの再生成: [bond-lab/wnja v1.1](https://github.com/bond-lab/wnja) の `wnjpn.db.gz` を `raw/` にダウンロードし、`node --no-warnings tools/build-words.mjs` を実行します。

## データの出典

語データの出典とライセンスは [LICENSE-DATA.md](LICENSE-DATA.md) を参照してください。
