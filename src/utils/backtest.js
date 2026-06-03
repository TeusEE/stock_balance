// 6개월 백테스트 — 비중 가중 수익률을 클라이언트에서 계산.
// 환차익·거래비용은 MVP 미반영 (종목 자기 통화 기준).
// 배당은 조정 종가(adjclose) 제공 시 반영됨 (stockApi.parseChartSeries).
//
// 사용 흐름:
//   1) buildAccountWeights(account)   또는   buildConsolidatedWeights(holdings)
//        → [{ symbol, name, weight }, ...]   (symbol 없는 항목도 함께 들어옴)
//   2) fetchHistoricalCloses([...uniqueSymbols], '6mo')
//        → priceMap: { [symbol]: { startClose, endClose, currency, ... } }
//   3) computeBacktest(weighted, priceMap)
//        → { totalReturnPercent, includedWeightSum, included[], excluded[] }

/**
 * 계좌 한 개의 항목들을 백테스트 입력으로 변환.
 * weight 는 v1 의 목표 비중(`targetPercent`) 을 그대로 사용한다.
 */
export function buildAccountWeights(account) {
  if (!account || !Array.isArray(account.items)) return [];
  return account.items.map((item) => ({
    symbol: item.symbol,
    name: item.name,
    weight: Number(item.targetPercent) || 0,
  }));
}

/**
 * `aggregateAcrossAccounts(...).holdings` 결과를 백테스트 입력으로 변환.
 * weight 는 통합 합산 비중(%).
 */
export function buildConsolidatedWeights(holdings) {
  if (!Array.isArray(holdings)) return [];
  return holdings.map((h) => ({
    symbol: h.symbol,
    name: h.name,
    weight: Number(h.percent) || 0,
  }));
}

/**
 * 가중치 + 과거시세 맵으로 6개월 보유 수익률을 계산.
 *
 * 결측 처리 — 다음 항목은 제외하고 남은 비중을 재정규화한다:
 *   - 심볼이 없는 항목 (수동/현금)      → reason: 'no-symbol'
 *   - priceMap 에 없거나 시리즈 결측    → reason: 'no-data'
 *   - weight <= 0                       → reason: 'zero-weight'
 *
 * 포함 종목이 0개면 totalReturnPercent: null.
 */
export function computeBacktest(weighted, priceMap = {}) {
  const included = [];
  const excluded = [];

  for (const w of weighted || []) {
    const wt = Number(w.weight) || 0;
    if (wt <= 0) {
      excluded.push({ symbol: w.symbol ?? null, name: w.name, reason: 'zero-weight' });
      continue;
    }
    if (!w.symbol) {
      excluded.push({ symbol: null, name: w.name, reason: 'no-symbol' });
      continue;
    }
    const series = priceMap[w.symbol];
    if (
      !series ||
      typeof series.startClose !== 'number' ||
      typeof series.endClose !== 'number' ||
      !isFinite(series.startClose) ||
      series.startClose <= 0
    ) {
      excluded.push({ symbol: w.symbol, name: w.name, reason: 'no-data' });
      continue;
    }
    const stockReturn = (series.endClose - series.startClose) / series.startClose;
    included.push({
      symbol: w.symbol,
      name: w.name,
      weight: wt,
      stockReturnPercent: stockReturn * 100,
    });
  }

  const includedWeightSum = included.reduce((s, it) => s + it.weight, 0);

  if (included.length === 0 || includedWeightSum <= 0) {
    // 포함된 종목이 없으면 수익률 계산 불가
    for (const it of included) {
      it.normalizedWeight = 0;
    }
    return {
      totalReturnPercent: null,
      includedWeightSum: 0,
      included,
      excluded,
    };
  }

  let totalReturn = 0;
  for (const it of included) {
    it.normalizedWeight = (it.weight / includedWeightSum) * 100;
    totalReturn += (it.weight / includedWeightSum) * (it.stockReturnPercent / 100);
  }

  return {
    totalReturnPercent: totalReturn * 100,
    includedWeightSum,
    included,
    excluded,
  };
}

/**
 * 백테스트 입력에서 조회가 필요한 유니크 심볼 목록을 추출.
 * (no-symbol 항목은 자동으로 빠진다.)
 */
export function uniqueSymbolsForBacktest(weighted) {
  const set = new Set();
  for (const w of weighted || []) {
    if (w.symbol && (Number(w.weight) || 0) > 0) set.add(w.symbol);
  }
  return Array.from(set);
}

// ───────────────────────────────────────────────────────────────────
// v2.1 — N일 주기 리밸런싱 시뮬레이션
// ───────────────────────────────────────────────────────────────────

const SECONDS_PER_DAY = 86400;

/**
 * 여러 종목의 일별 시리즈를 공통 날짜축으로 정렬합니다.
 *
 * - 거래소별 휴장일이 달라 영업일이 어긋나므로, UTC 일 단위 키(ts/86400)로
 *   합친 뒤 빠진 날은 **직전값 forward-fill** 로 채운다.
 * - 윈도우는 모든 종목이 데이터를 가진 공통 구간 [max(시작), min(끝)] 으로 절단.
 *
 * @param seriesList [{ symbol, timestamps[], closes[] }, ...]
 * @returns { dayKeys: number[], closesBySymbol: { [symbol]: number[] } } 또는
 *          null (공통 구간의 유효 일수가 2 미만)
 */
export function alignSeries(seriesList) {
  if (!Array.isArray(seriesList) || seriesList.length === 0) return null;

  // 심볼별 [dayKey, close] 쌍 (dayKey 중복 시 마지막 값 유지)
  const pairsBySymbol = new Map();
  let windowStart = -Infinity;
  let windowEnd = Infinity;

  for (const s of seriesList) {
    if (!s || !Array.isArray(s.timestamps) || !Array.isArray(s.closes)) return null;
    const pairs = [];
    const len = Math.min(s.timestamps.length, s.closes.length);
    for (let i = 0; i < len; i++) {
      const c = s.closes[i];
      if (typeof c !== 'number' || !isFinite(c) || c <= 0) continue;
      const day = Math.floor(s.timestamps[i] / SECONDS_PER_DAY);
      if (pairs.length > 0 && pairs[pairs.length - 1][0] === day) {
        pairs[pairs.length - 1][1] = c;
      } else {
        pairs.push([day, c]);
      }
    }
    if (pairs.length < 2) return null;
    pairsBySymbol.set(s.symbol, pairs);
    windowStart = Math.max(windowStart, pairs[0][0]);
    windowEnd = Math.min(windowEnd, pairs[pairs.length - 1][0]);
  }
  if (windowEnd <= windowStart) return null;

  // 공통 구간 안의 모든 거래일(합집합)을 날짜축으로
  const daySet = new Set();
  for (const pairs of pairsBySymbol.values()) {
    for (const [day] of pairs) {
      if (day >= windowStart && day <= windowEnd) daySet.add(day);
    }
  }
  const dayKeys = Array.from(daySet).sort((a, b) => a - b);
  if (dayKeys.length < 2) return null;

  // 심볼별로 날짜축을 걸으며 직전값 forward-fill
  const closesBySymbol = {};
  for (const [symbol, pairs] of pairsBySymbol.entries()) {
    const filled = new Array(dayKeys.length);
    let idx = 0;
    let last = null;
    for (let t = 0; t < dayKeys.length; t++) {
      while (idx < pairs.length && pairs[idx][0] <= dayKeys[t]) {
        last = pairs[idx][1];
        idx++;
      }
      filled[t] = last; // windowStart >= 각 시리즈의 첫 날이므로 last 는 항상 채워짐
    }
    closesBySymbol[symbol] = filled;
  }

  return { dayKeys, closesBySymbol };
}

/**
 * N영업일 주기 리밸런싱 백테스트 시뮬레이션 (v2.1).
 *
 * `intervalDays`:
 *   - null  → 보유(buy-and-hold, 리밸런싱 없음). 공통 윈도우 기준이라
 *             각 종목 자체 윈도우를 쓰는 `computeBacktest` 와 수일 오차 내에서 일치.
 *   - 5/21/63 → 매주/매월/매분기(영업일 기준) 리밸런싱.
 *
 * 제외 규칙은 `computeBacktest` 와 동일 + 시리즈 배열이 없으면 'no-data'.
 * 통화는 종목 자기 통화 기준(환차익 제외) — v2.0 과 동일한 정규화 공간.
 *
 * @returns {
 *   totalReturnPercent,            // 포함 0개 또는 정렬 불가 시 null
 *   includedWeightSum,
 *   included: [{ symbol, name, weight, normalizedWeight, stockReturnPercent }],
 *   excluded: [{ symbol|null, name, reason }],
 *   intervalDays, rebalanceCount,
 *   windowStartTs, windowEndTs, tradingDays,
 * }
 */
export function simulate(weighted, seriesMap = {}, { intervalDays = null } = {}) {
  const included = [];
  const excluded = [];

  for (const w of weighted || []) {
    const wt = Number(w.weight) || 0;
    if (wt <= 0) {
      excluded.push({ symbol: w.symbol ?? null, name: w.name, reason: 'zero-weight' });
      continue;
    }
    if (!w.symbol) {
      excluded.push({ symbol: null, name: w.name, reason: 'no-symbol' });
      continue;
    }
    const series = seriesMap[w.symbol];
    if (
      !series ||
      !Array.isArray(series.timestamps) ||
      !Array.isArray(series.closes) ||
      series.closes.length < 2
    ) {
      excluded.push({ symbol: w.symbol, name: w.name, reason: 'no-data' });
      continue;
    }
    included.push({ symbol: w.symbol, name: w.name, weight: wt });
  }

  const includedWeightSum = included.reduce((s, it) => s + it.weight, 0);

  const emptyResult = () => ({
    totalReturnPercent: null,
    includedWeightSum: 0,
    included,
    excluded,
    intervalDays,
    rebalanceCount: 0,
    windowStartTs: null,
    windowEndTs: null,
    tradingDays: 0,
  });

  if (included.length === 0 || includedWeightSum <= 0) {
    for (const it of included) it.normalizedWeight = 0;
    return emptyResult();
  }

  // 같은 심볼이 여러 행이어도 시리즈는 한 번만 정렬
  const uniqueSeries = [];
  const seen = new Set();
  for (const it of included) {
    if (seen.has(it.symbol)) continue;
    seen.add(it.symbol);
    const s = seriesMap[it.symbol];
    uniqueSeries.push({ symbol: it.symbol, timestamps: s.timestamps, closes: s.closes });
  }

  const aligned = alignSeries(uniqueSeries);
  if (!aligned) {
    for (const it of included) it.normalizedWeight = 0;
    return emptyResult();
  }
  const { dayKeys, closesBySymbol } = aligned;
  const lastT = dayKeys.length - 1;

  // 종목별 공통 윈도우 수익률 (표시용)
  for (const it of included) {
    it.normalizedWeight = (it.weight / includedWeightSum) * 100;
    const prices = closesBySymbol[it.symbol];
    it.stockReturnPercent = ((prices[lastT] - prices[0]) / prices[0]) * 100;
  }

  // 가치 추적 시뮬레이션 (totalStart = 1)
  let values = included.map((it) => it.weight / includedWeightSum);
  let sinceRebalance = 0;
  let rebalanceCount = 0;

  for (let t = 1; t <= lastT; t++) {
    for (let i = 0; i < included.length; i++) {
      const prices = closesBySymbol[included[i].symbol];
      values[i] *= prices[t] / prices[t - 1];
    }
    sinceRebalance++;
    // 마지막 날의 리밸런싱은 총액을 바꾸지 않으므로 생략
    if (intervalDays != null && sinceRebalance >= intervalDays && t < lastT) {
      const total = values.reduce((s, v) => s + v, 0);
      values = included.map((it) => total * (it.weight / includedWeightSum));
      sinceRebalance = 0;
      rebalanceCount++;
    }
  }

  const total = values.reduce((s, v) => s + v, 0);

  return {
    totalReturnPercent: (total - 1) * 100,
    includedWeightSum,
    included,
    excluded,
    intervalDays,
    rebalanceCount,
    windowStartTs: dayKeys[0] * SECONDS_PER_DAY,
    windowEndTs: dayKeys[lastT] * SECONDS_PER_DAY,
    tradingDays: dayKeys.length,
  };
}
