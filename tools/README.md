# tools

## フォントを woff2 にする（fonts/DotGothic16-Regular.woff2）

ブラウザへ送る前の圧縮形式。サブセットはせず、形式を変えるだけ。Python の fontTools と brotli を、プロジェクトの外の一時フォルダに入れて使う。

```
python -m pip install --target <一時フォルダ> fonttools brotli
PYTHONPATH=<一時フォルダ> python -c "from fontTools.ttLib import TTFont; f=TTFont('fonts/DotGothic16-Regular.ttf'); f.flavor='woff2'; f.save('fonts/DotGothic16-Regular.woff2')"
```

style.css の @font-face は woff2 を先に、ttf を予備に読む。

## アイコン（icons/）

`node tools/build-icons.mjs`（ドット絵の「7」を PNG に書く。依存なし）。
