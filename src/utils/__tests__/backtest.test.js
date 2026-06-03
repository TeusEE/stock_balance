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

// ───────────────────────────────────────────────────────────────────
// v2.1 — alignSeries / simulate (N일 주기 리밸런싱)
// ───────────────────────────────────────────────────────────────────

import { alignSeries, simulate } from '../backtest';

const DAY = 86400;

// closes 배열로 일별 시리즈 생성 (dayOffsets 생략 시 0,1,2,... 연속 영업일)
function series(closes, dayOffsets) {
  const days = dayOffsets ?? closes.map((_, i) => i);
  return {
    timestamps: days.map((d) => d * DAY),
    closes,
    startClose: closes[0],
    endClose: closes[closes.length - 1],
  };
}

describe('alignSeries (공통 날짜축 + forward-fill)', () => {
  test('휴장일이 어긋난 두 시리즈를 합집합 축으로 정렬하고 빈 날을 직전값으로 채운다', () => {
    const a = { symbol: 'A', ...series([10, 11, 12, 13, 14]) };          // 0~4일
    const b = { symbol: 'B', ...series([20, 22, 24], [0, 2, 4]) };       // 1,3일 휴장
    const aligned = alignSeries([a, b]);
    expect(aligned.dayKeys).toEqual([0, 1, 2, 3, 4]);
    expect(aligned.closesBySymbol.A).toEqual([10, 11, 12, 13, 14]);
    expect(aligned.closesBySymbol.B).toEqual([20, 20, 22, 22, 24]);     // forward-fill
  });

  test('공통 구간 [max(시작), min(끝)] 으로 절단한다', () => {
    const a = { symbol: 'A', ...series([1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]) };
    const b = { symbol: 'B', ...series([10, 20, 30], [2, 3, 4]) };
    const aligned = alignSeries([a, b]);
    expect(aligned.dayKeys).toEqual([2, 3, 4]);
    expect(aligned.closesBySymbol.A).toEqual([3, 4, 5]);
    expect(aligned.closesBySymbol.B).toEqual([10, 20, 30]);
  });

  test('공통 구간이 없으면(겹치는 날 < 2) null', () => {
    const a = { symbol: 'A', ...series([1, 2], [0, 1]) };
    const b = { symbol: 'B', ...series([1, 2], [5, 6]) };
    expect(alignSeries([a, b])).toBeNull();
  });
});

describe('simulate (보유 / N일 리밸런싱)', () => {
  test('intervalDays=null(보유)은 computeBacktest 와 같은 수익률을 낸다 (같은 윈도우)', () => {
    const weighted = [
      { symbol: 'A', name: 'A', weight: 60 },
      { symbol: 'B', name: 'B', weight: 40 },
    ];
    const map = {
      A: series([100, 105, 110]),   // +10%
      B: series([200, 190, 180]),   // -10%
    };
    const hold = simulate(weighted, map, { intervalDays: null });
    const v20 = computeBacktest(weighted, map);
    expect(hold.totalReturnPercent).toBeCloseTo(2, 10);   // 0.6×10% − 0.4×10%
    expect(hold.totalReturnPercent).toBeCloseTo(v20.totalReturnPercent, 10);
    expect(hold.rebalanceCount).toBe(0);
    expect(hold.tradingDays).toBe(3);
  });

  test('단일 종목이면 보유와 리밸런싱 수익률이 동일하다', () => {
    const weighted = [{ symbol: 'A', name: 'A', weight: 100 }];
    const map = { A: series([100, 120, 90, 130, 110]) };
    const hold = simulate(weighted, map, { intervalDays: null });
    const daily = simulate(weighted, map, { intervalDays: 1 });
    expect(daily.totalReturnPercent).toBeCloseTo(hold.totalReturnPercent, 10);
    expect(hold.totalReturnPercent).toBeCloseTo(10, 10);
  });

  test('반대로 움직이는 두 종목은 리밸런싱이 보유보다 유리하다 (rebalancing bonus)', () => {
    // A: ×2, ×0.5 반복 / B: ×0.5, ×2 반복 → 보유 0%,
    // 매일 리밸런싱: 매일 0.5×2 + 0.5×0.5 = 1.25배 → 1.25^4 − 1 = +144.14%
    const weighted = [
      { symbol: 'A', name: 'A', weight: 50 },
      { symbol: 'B', name: 'B', weight: 50 },
    ];
    const map = {
      A: series([1, 2, 1, 2, 1]),
      B: series([1, 0.5, 1, 0.5, 1]),
    };
    const hold = simulate(weighted, map, { intervalDays: null });
    const daily = simulate(weighted, map, { intervalDays: 1 });
    expect(hold.totalReturnPercent).toBeCloseTo(0, 10);
    expect(daily.totalReturnPercent).toBeCloseTo(Math.pow(1.25, 4) * 100 - 100, 8);
    expect(daily.totalReturnPercent).toBeGreaterThan(hold.totalReturnPercent);
    expect(daily.rebalanceCount).toBe(3); // 마지막 날 리밸런싱은 생략
  });

  test('intervalDays 가 시리즈 길이 이상이면 보유와 동일 (rebalanceCount 0)', () => {
    const weighted = [
      { symbol: 'A', name: 'A', weight: 50 },
      { symbol: 'B', name: 'B', weight: 50 },
    ];
    const map = { A: series([1, 2, 1]), B: series([1, 0.5, 1]) };
    const hold = simulate(weighted, map, { intervalDays: null });
    const sparse = simulate(weighted, map, { intervalDays: 63 });
    expect(sparse.totalReturnPercent).toBeCloseTo(hold.totalReturnPercent, 10);
    expect(sparse.rebalanceCount).toBe(0);
  });

  test('제외 규칙은 computeBacktest 와 동일 + 시리즈 배열 없으면 no-data', () => {
    const weighted = [
      { symbol: 'A', name: 'A', weight: 40 },
      { symbol: undefined, name: '현금', weight: 30 },
      { symbol: 'OLD', name: '배열없음', weight: 20 },
      { symbol: 'Z', name: '비중0', weight: 0 },
    ];
    const map = {
      A: series([100, 110]),
      OLD: { startClose: 100, endClose: 110, currency: 'KRW' }, // v2.0 형태 (배열 없음)
    };
    const r = simulate(weighted, map, { intervalDays: 5 });
    expect(r.included.map((i) => i.symbol)).toEqual(['A']);
    expect(r.included[0].normalizedWeight).toBe(100); // 재정규화
    expect(r.excluded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '현금', reason: 'no-symbol' }),
        expect.objectContaining({ symbol: 'OLD', reason: 'no-data' }),
        expect.objectContaining({ symbol: 'Z', reason: 'zero-weight' }),
      ]),
    );
    expect(r.totalReturnPercent).toBeCloseTo(10, 10);
  });

  test('포함 종목이 0개면 totalReturnPercent: null', () => {
    const r = simulate([{ symbol: undefined, name: '현금', weight: 100 }], {}, { intervalDays: 5 });
    expect(r.totalReturnPercent).toBeNull();
    expect(r.includedWeightSum).toBe(0);
  });

  test('휴장일 어긋남 + 월간 리밸런싱이 함께 동작한다 (forward-fill 경유)', () => {
    const weighted = [
      { symbol: 'KR', name: '한국주', weight: 50 },
      { symbol: 'US', name: '미국주', weight: 50 },
    ];
    const map = {
      KR: series([100, 102, 104, 106, 108, 110], [0, 1, 2, 3, 4, 5]),
      US: series([50, 51, 53, 55], [0, 2, 4, 5]), // 1, 3일 휴장
    };
    const r = simulate(weighted, map, { intervalDays: 2 });
    expect(r.totalReturnPercent).not.toBeNull();
    expect(r.tradingDays).toBe(6);
    expect(r.rebalanceCount).toBe(2); // t=2, t=4 (t=5는 마지막 날이므로 생략)
  });
});
