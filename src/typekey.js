// リールの種類キーの組み立て・分解（DOM なし）。
// 単一: 素のキー（'verb' / 'my:海'）。複数: 'mix:<k1>|<k2>|…'。0個は 'any'。'any' は他と混ぜない。
export const MIX = 'mix:';
// 自作テーマの名前に | や % があっても分解できるように、mix の中でだけ符号化する
const enc = s => s.replace(/%/g, '%25').replace(/\|/g, '%7C');
const dec = s => s.replace(/%7C/g, '|').replace(/%25/g, '%');

export const parseType = type => (type.startsWith(MIX) ? type.slice(MIX.length).split('|').filter(Boolean).map(dec) : [type]);

export function buildType(keys) {
  const u = [...new Set(keys)], k = u.length > 1 ? u.filter(x => x !== 'any') : u;
  return k.length === 0 ? 'any' : k.length === 1 ? k[0] : MIX + k.map(enc).join('|');
}

// 種類 k を足す／外す。最後の1つは外せない（そのまま返す）。'any' を選ぶと他が外れ、他を選ぶと 'any' が外れる
export function toggleType(type, k) {
  if (k === 'any') return 'any';
  const keys = parseType(type);
  if (keys.includes(k)) return keys.length > 1 ? buildType(keys.filter(x => x !== k)) : type;
  return buildType([...keys.filter(x => x !== 'any'), k]);
}

// 存在しない種類（消えた自作テーマなど）を落とす
export const normalizeType = (type, isValid) => buildType(parseType(type).filter(isValid));

// from を to に付け替える（to が null なら外す）
export const remapType = (type, from, to) => buildType(parseType(type).flatMap(k => (k !== from ? [k] : to === null ? [] : [to])));
