const NOUN = {
  animal: '動物', plant: '植物', food: '食べ物', person: '人・職業', place: '場所・建物', tool: '道具・乗り物',
  nature: '自然・天気', body: '体', feeling: '感情・状態', event: '出来事', abstract: '抽象概念', other: 'その他',
};
const TAG = { look: 'タグ：見た目', mood: 'タグ：雰囲気・テーマ', mechanic: 'タグ：仕組み' };

export const TYPE_LABELS = {
  any: '全部ランダム',
  noun: '単語（全部）',
  ...Object.fromEntries(Object.entries(NOUN).map(([k, v]) => [`noun:${k}`, v])),
  verb: '動詞',
  genre: 'ゲームジャンル',
  game: 'ゲーム',
  tag: 'タグ（全部）',
  ...Object.fromEntries(Object.entries(TAG).map(([k, v]) => [`tag:${k}`, v])),
};
export const TYPE_KEYS = Object.keys(TYPE_LABELS);

export const MY = 'my:'; // 自作テーマの種類キーの頭（my:<名前>）

// 種類えらびパネルのグループ。items: {k: 種類キー, text: ボタンの文字}。自作テーマが無ければそのグループは無い
export function typeGroups(themes) {
  const text = k => TYPE_LABELS[k].replace(/^タグ：/, '');
  const of = pick => TYPE_KEYS.filter(pick).map(k => ({ k, text: text(k) }));
  return [
    { title: null, items: of(k => k === 'any') },
    { title: '単語', items: of(k => k.startsWith('noun')) },
    { title: 'その他の種類', items: of(k => ['verb', 'genre', 'game'].includes(k)) },
    { title: 'タグ', items: of(k => k.startsWith('tag')) },
    ...(themes.length ? [{ title: '自分のテーマ', items: themes.map(t => ({ k: MY + t.name, text: `★${t.name}（${t.words.length}語）` })) }] : []),
  ];
}
