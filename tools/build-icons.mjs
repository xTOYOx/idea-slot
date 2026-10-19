// PWA のアイコン（icons/*.png）を作る。ドット絵の「7」を 16×16 で描いて、最近傍で拡大して PNG に書く。
// 使い方: node tools/build-icons.mjs
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const COL = { k: [0, 0, 0], g: [232, 176, 32], G: [15, 90, 58], r: [224, 48, 62], y: [255, 224, 102], s: [8, 58, 38] };
// 16×16。外から黒の縁・金の枠・緑の地。「7」は赤で、上の横棒だけ黄色、右下に影
const SEVEN = [
  '................',
  '................',
  '................',
  '...yyyyyyyyyy...',
  '...rrrrrrrrrr...',
  '..........rrr...',
  '.........rrr....',
  '.........rrr....',
  '........rrr.....',
  '........rrr.....',
  '.......rrr......',
  '.......rrr......',
  '......rrr.......',
  '................',
  '................',
  '................',
];
const N = 16;
function cell(x, y) {
  if (x === 0 || y === 0 || x === N - 1 || y === N - 1) return 'k';
  if (x === 1 || y === 1 || x === N - 2 || y === N - 2) return 'g';
  const at = (a, b) => SEVEN[b]?.[a] ?? '.';
  if (at(x, y) !== '.') return at(x, y);
  if (at(x - 1, y - 1) !== '.') return 's'; // 影
  return 'G';
}

const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};
function png(size) {
  const rows = Buffer.alloc(size * (size * 3 + 1)); // 各行の先頭 1 バイトはフィルター 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = COL[cell(Math.floor(x * N / size), Math.floor(y * N / size))];
      rows.set(c, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head.set([8, 2, 0, 0, 0], 8); // 8bit・RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('icons', { recursive: true });
for (const [name, size] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) writeFileSync(`icons/${name}.png`, png(size));
