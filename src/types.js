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
