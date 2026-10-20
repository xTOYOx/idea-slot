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

// groups: typeGroups の形。{members: 見出しがまとめて扱う種類キー, all?: まとめの種類キー}
// まとめ（all）が選ばれていれば、その members も選ばれている扱いにする
export const checkedKeys = (keys, groups) => new Set([...keys, ...groups.filter(g => g.all && keys.includes(g.all)).flatMap(g => g.members ?? [])]);

// 見出しのチェック状態: members が全部 'true' / 1つも無し 'false' / 一部 'mixed'
export function groupState(keys, g) {
  const c = checkedKeys(keys, [g]), n = g.members.filter(k => c.has(k)).length;
  return n === 0 ? 'false' : n === g.members.length ? 'true' : 'mixed';
}

// 種類 k を足す／外す。最後の1つを外すと 'any'（全部ランダム）に戻る。'any' を選ぶと他が外れ、他を選ぶと 'any' が外れる
// groups があれば、まとめが選ばれた中の1つを外すときはまとめを個別に展開し、個別に全部そろったらまとめに戻す
export function toggleType(type, k, groups = []) {
  if (k === 'any') return 'any';
  let keys = parseType(type);
  const g = groups.find(x => x.all && keys.includes(x.all) && x.members.includes(k));
  if (g) keys = [...keys.filter(x => x !== g.all), ...g.members];
  if (keys.includes(k)) return keys.length > 1 ? buildType(keys.filter(x => x !== k)) : 'any'; // 最後の1つを外したら全部ランダムに戻す
  keys = [...keys.filter(x => x !== 'any'), k];
  for (const x of groups) if (x.all && x.members.every(m => keys.includes(m))) keys = [...keys.filter(y => !x.members.includes(y)), x.all];
  return buildType(keys);
}

// 見出しのチェックを押す: 全部そろっていれば members とまとめを外す、そうでなければまとめ（無ければ members 全部）を足す。ほかの選択は保つ
export function toggleGroup(type, g) {
  const keys = parseType(type).filter(x => x !== 'any'), rest = keys.filter(x => x !== g.all && !g.members.includes(x));
  return buildType(groupState(keys, g) === 'true' ? rest : [...rest, ...(g.all ? [g.all] : g.members)]);
}

// 存在しない種類（消えた自作テーマなど）を落とす
export const normalizeType = (type, isValid) => buildType(parseType(type).filter(isValid));

// from を to に付け替える（to が null なら外す）
export const remapType = (type, from, to) => buildType(parseType(type).flatMap(k => (k !== from ? [k] : to === null ? [] : [to])));
