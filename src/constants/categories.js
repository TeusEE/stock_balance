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

const SYMBOL_CATEGORY = {
  BIL: 'cash',
  SGOV: 'cash',
  SHV: 'cash',
  SCHD: 'dividend',
  VIG: 'dividend',
  VYM: 'dividend',
  DGRO: 'dividend',
  JEPI: 'dividend',
  JEPQ: 'dividend',
  QYLD: 'dividend',
  SPHD: 'dividend',
  TLT: 'bond',
  IEF: 'bond',
  SHY: 'bond',
  BND: 'bond',
  AGG: 'bond',
  LQD: 'bond',
  HYG: 'bond',
  TMF: 'bond',
  GLD: 'physical',
  IAU: 'physical',
  SLV: 'physical',
  USO: 'physical',
  DBC: 'physical',
  VNQ: 'physical',
  VNQI: 'physical',
};

function normalizedSymbol(symbol) {
  return String(symbol ?? '')
    .trim()
    .toUpperCase()
    .replace(/\.(KS|KQ)$/, '');
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

/**
 * 검색으로 선택된 종목/ETF의 이름과 티커를 보고 기본 분류를 추정합니다.
 * 명확한 키워드만 분류하고, 애매한 일반 주식/지수 ETF는 성장형으로 둡니다.
 */
export function inferDefaultCategory(stock = {}) {
  const symbol = normalizedSymbol(stock.symbol);
  if (SYMBOL_CATEGORY[symbol]) return SYMBOL_CATEGORY[symbol];

  const text = [
    stock.name,
    stock.shortname,
    stock.longname,
    stock.exchange,
    stock.symbol,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!text.trim()) return DEFAULT_CATEGORY;

  if (
    includesAny(text, [
      '현금',
      '파킹',
      '단기금융',
      '머니마켓',
      'mmf',
      'cma',
      'cash',
      'money market',
      'treasury bill',
      't-bill',
    ])
  ) {
    return 'cash';
  }

  if (
    includesAny(text, [
      '채권',
      '국채',
      '국고채',
      '회사채',
      '종합채',
      '물가채',
      'treasury bond',
      'treasury etf',
      'bond',
      'fixed income',
    ])
  ) {
    return 'bond';
  }

  if (
    includesAny(text, [
      '배당',
      '고배당',
      '월배당',
      'dividend',
      'income etf',
      'covered call',
      '커버드콜',
    ])
  ) {
    return 'dividend';
  }

  if (
    includesAny(text, [
      '금현물',
      '금선물',
      'krx금',
      '골드',
      '은선물',
      '원유',
      '구리',
      '원자재',
      '커머디티',
      '리츠',
      '부동산',
      '인프라',
      'gold trust',
      'gold shares',
      'silver trust',
      'commodity',
      'crude oil',
      'real estate',
      'reit',
    ])
  ) {
    return 'physical';
  }

  return DEFAULT_CATEGORY;
}

export function categoryLabel(key) {
  return byKey[key]?.label ?? '미분류';
}

export function categoryColor(key) {
  return byKey[key]?.color ?? '#9aa3b2';
}
