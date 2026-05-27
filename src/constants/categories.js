// 종목 분류 5가지 유형
export const CATEGORIES = [
  { key: 'growth', label: '성장형', color: '#4f8cff' },
  { key: 'dividend', label: '배당투자형', color: '#3ecf8e' },
  { key: 'bond', label: '채권형', color: '#ffb454' },
  { key: 'physical', label: '실물형', color: '#a78bfa' },
  { key: 'cash', label: '현금형', color: '#9aa3b2' },
];

export const DEFAULT_CATEGORY = 'growth';

const byKey = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export function categoryLabel(key) {
  return byKey[key]?.label ?? '미분류';
}

export function categoryColor(key) {
  return byKey[key]?.color ?? '#9aa3b2';
}
