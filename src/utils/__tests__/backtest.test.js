import {
  buildAccountWeights,
  buildConsolidatedWeights,
  computeBacktest,
  uniqueSymbolsForBacktest,
} from '../backtest';

// 심볼별 단순 시리즈를 만드는 헬퍼
function s(start, end, currency = 'KRW') {
  return { startClose: start, endClose: end, currency };
}

describe('buildAccountWeights / buildConsolidatedWeights', () => {
  test('계좌 항목의 targetPercent 를 weight 로 가져온다', () => {
    const acc = {
      items: [
        { name: '삼성전자', symbol: '005930.KS', targetPercent: 50 },
        { name: '현금', targetPercent: 50, manual: true },
      ],
    };
    expect(buildAccountWeights(acc)).toEqual([
      { symbol: '005930.KS', name: '삼성전자', weight: 50 },
      { symbol: undefined, name: '현금', weight: 50 },
    ]);
  });

  test('통합 holdings 의 percent 를 weight 로 가져온다', () => {
    const holdings = [
      { name: 'A', symbol: 'A.X', percent: 60 },
      { name: 'B', symbol: 'B.X', percent: 40 },
    ];
    expect(buildConsolidatedWeights(holdings)).toEqual([
      { symbol: 'A.X', name: 'A', weight: 60 },
      { symbol: 'B.X', name: 'B', weight: 40 },
    ]);
  });
});

describe('uniqueSymbolsForBacktest', () => {
  test('심볼 있는 양수 weight 만 유니크 추출', () => {
    expect(
      uniqueSymbolsForBacktest([
        { symbol: 'A', weight: 50 },
        { symbol: 'A', weight: 50 }, // dup
        { symbol: 'B', weight: 0 }, // zero weight
        { symbol: undefined, weight: 30 }, // no symbol
      ]),
    ).toEqual(['A']);
  });
});

describe('computeBacktest — 기본 가중 수익률', () => {
  test('두 종목 50:50, 각각 +10% / -5% → 가중 평균 +2.5%', () => {
    const weighted = [
      { symbol: 'A.X', name: 'A', weight: 50 },
      { symbol: 'B.X', name: 'B', weight: 50 },
    ];
    const priceMap = {
      'A.X': s(100, 110),
      'B.X': s(200, 190),
    };
    const r = computeBacktest(weighted, priceMap);
    expect(r.totalReturnPercent).toBeCloseTo(2.5, 6);
    expect(r.included).toHaveLength(2);
    expect(r.excluded).toHaveLength(0);
    expect(r.includedWeightSum).toBe(100);
  });

  test('음수 수익률도 정확히 가중', () => {
    const weighted = [
      { symbol: 'A.X', name: 'A', weight: 70 },
      { symbol: 'B.X', name: 'B', weight: 30 },
    ];
    const priceMap = {
      'A.X': s(100, 80), // -20%
      'B.X': s(100, 90), // -10%
    };
    const r = computeBacktest(weighted, priceMap);
    expect(r.totalReturnPercent).toBeCloseTo(0.7 * -20 + 0.3 * -10, 6);
  });
});

describe('computeBacktest — 결측 처리 + 재정규화', () => {
  test('심볼 없는 항목과 시리즈 없는 항목은 제외하고 나머지로 재정규화', () => {
    const weighted = [
      { symbol: 'A.X', name: 'A', weight: 40 },
      { symbol: 'B.X', name: 'B', weight: 40 }, // 시리즈 없음
      { symbol: undefined, name: '현금', weight: 20 }, // 심볼 없음
    ];
    const priceMap = {
      'A.X': s(100, 120), // +20%
    };
    const r = computeBacktest(weighted, priceMap);

    // A 만 포함 → 정규화 비중 100% → 총 수익률 = 20%
    expect(r.included).toHaveLength(1);
    expect(r.included[0].symbol).toBe('A.X');
    expect(r.included[0].normalizedWeight).toBeCloseTo(100, 6);
    expect(r.totalReturnPercent).toBeCloseTo(20, 6);

    expect(r.excluded).toHaveLength(2);
    const reasons = r.excluded.map((e) => e.reason).sort();
    expect(reasons).toEqual(['no-data', 'no-symbol']);
  });

  test('비중 합이 100% 가 아니어도 재정규화로 합산이 맞음 (50:30)', () => {
    const weighted = [
      { symbol: 'A.X', name: 'A', weight: 50 },
      { symbol: 'B.X', name: 'B', weight: 30 },
      // 나머지 20% 는 현금(심볼 없음) 가정
      { symbol: undefined, name: '현금', weight: 20 },
    ];
    const priceMap = {
      'A.X': s(100, 110), // +10%
      'B.X': s(100, 100), //  0%
    };
    const r = computeBacktest(weighted, priceMap);
    // 포함 가중치 합 = 80, 정규화: A=62.5%, B=37.5%
    // 총 수익률 = 0.625*10 + 0.375*0 = 6.25%
    expect(r.totalReturnPercent).toBeCloseTo(6.25, 6);
    expect(r.includedWeightSum).toBe(80);
    expect(r.included.find((i) => i.symbol === 'A.X').normalizedWeight).toBeCloseTo(62.5, 6);
  });

  test('포함 종목이 0개면 totalReturnPercent 는 null', () => {
    const weighted = [
      { symbol: undefined, name: '현금', weight: 100 },
    ];
    const r = computeBacktest(weighted, {});
    expect(r.totalReturnPercent).toBeNull();
    expect(r.included).toHaveLength(0);
    expect(r.excluded).toHaveLength(1);
  });

  test('weight <= 0 인 항목은 zero-weight 사유로 제외', () => {
    const weighted = [
      { symbol: 'A.X', name: 'A', weight: 100 },
      { symbol: 'B.X', name: 'B', weight: 0 },
    ];
    const priceMap = { 'A.X': s(100, 110), 'B.X': s(100, 200) };
    const r = computeBacktest(weighted, priceMap);
    expect(r.included).toHaveLength(1);
    expect(r.excluded[0].reason).toBe('zero-weight');
    expect(r.totalReturnPercent).toBeCloseTo(10, 6);
  });

  test('startClose 가 0 이거나 음수면 시리즈가 있어도 no-data 로 제외', () => {
    const weighted = [
      { symbol: 'A.X', name: 'A', weight: 100 },
    ];
    const r = computeBacktest(weighted, { 'A.X': s(0, 100) });
    expect(r.excluded[0].reason).toBe('no-data');
  });
});
