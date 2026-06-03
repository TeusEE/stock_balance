// 6개월 백테스트 — 비중 가중 수익률을 클라이언트에서 계산.
// 환차익·배당·거래비용은 MVP 미반영 (종목 자기 통화 기준).
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
