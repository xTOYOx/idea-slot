// リールのテンプレート（{ name, slots: [{ type }] }）の純粋な操作。引数は変えず、新しい値を返す。
import { normalizeType } from './typekey.js';

const MIN = 2, MAX = 4; // リールの本数

// 保存・読み込み用に整える。名前は前後の空白を除く。本数や種類の形が違えば null
export function cleanTemplate(t) {
  if (t === null || typeof t !== 'object' || typeof t.name !== 'string' || !t.name.trim() || !Array.isArray(t.slots)) return null;
  if (t.slots.length < MIN || t.slots.length > MAX || !t.slots.every(s => s !== null && typeof s === 'object' && typeof s.type === 'string' && s.type)) return null;
  return { name: t.name.trim(), slots: t.slots.map(s => ({ type: s.type })) };
}

// 「3本：動物 × ゲーム用語 × 全部ランダム」。label: 種類キー → 表示名
export const describeSlots = (slots, label) => `${slots.length}本：${slots.map(s => label(s.type)).join(' × ')}`;

const slotsOf = slots => slots.map(s => ({ type: s.type }));

// 名前が空か、ほかのテンプレートと重なれば null
export function addTemplate(list, name, slots) {
  name = name.trim();
  return !name || list.some(t => t.name === name) ? null : [...list, { name, slots: slotsOf(slots) }];
}
export const replaceTemplate = (list, name, slots) => list.map(t => (t.name === name ? { name, slots: slotsOf(slots) } : t));
export const removeTemplate = (list, name) => list.filter(t => t.name !== name);

// 使うときの種類: 消えた自作テーマ・知らない種類は外す（何も残らなければ全部ランダム）
export const applySlots = (slots, isValid) => slots.map(s => ({ type: normalizeType(s.type, isValid) }));
