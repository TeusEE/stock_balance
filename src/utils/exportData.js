function round2(n) {
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * 단일 계좌를 내보내기용 JSON 객체로 변환합니다.
 *
 * @param account   계좌 객체
 * @param rebalance computeAccountRebalance(account) 결과 (선택)
 */
export function buildAccountExport(account, rebalance) {
  const items = (rebalance ? rebalance.items : account.items.map((item) => ({ item, rebalance: null }))).map(
    ({ item, rebalance: rb }) => ({
      name: item.name,
      symbol: item.symbol ?? null,
      category: item.category ?? null,
      manual: !!item.manual,
      targetPercent: round2(item.targetPercent),
      currentPrice: item.currentPrice ?? null,
      currency: item.currency ?? account.currency,
      ownedShares: item.ownedShares ?? null,
      ...(rb
        ? {
            targetValue: round2(rb.targetValue),
            recommendedShares: rb.shares,
            actualValue: round2(rb.actualValue),
            remaining: round2(rb.remaining),
            ownedValue: round2(rb.ownedValue),
            delta: rb.delta,
            additionalCost: round2(rb.additionalCost),
          }
        : {}),
    }),
  );

  const totalTargetPercent = round2(
    account.items.reduce((s, it) => s + (Number(it.targetPercent) || 0), 0),
  );

  return {
    type: 'stock-balance/account',
    version: 1,
    exportedAt: new Date().toISOString(),
    account: {
      name: account.name,
      totalAmount: account.totalAmount,
      currency: account.currency,
      totalTargetPercent,
      ...(rebalance
        ? {
            recommendedBuyTotal: round2(rebalance.totalActual),
            expectedCashLeft: round2(rebalance.totalUnallocated),
            additionalBuyCost: round2(rebalance.totalAdditionalCost),
          }
        : {}),
      items,
    },
  };
}

/**
 * 모든 계좌를 통합한 분포를 내보내기용 JSON 객체로 변환합니다.
 *
 * @param baseCurrency  'KRW' | 'USD'
 * @param totalBase     baseCurrency로 환산된 총 자산
 * @param holdings      aggregateAcrossAccounts() 의 holdings
 * @param accountsCount 계좌 수
 */
export function buildConsolidatedExport({ baseCurrency, totalBase, holdings, accountsCount }) {
  return {
    type: 'stock-balance/consolidated',
    version: 1,
    exportedAt: new Date().toISOString(),
    baseCurrency,
    totalValue: round2(totalBase),
    accountsCount,
    holdings: holdings.map((h) => ({
      name: h.name,
      symbol: h.symbol ?? null,
      percent: round2(h.percent),
      totalValue: round2(h.totalValue),
      perAccount: h.perAccount.map((p) => ({
        accountName: p.accountName,
        value: round2(p.value),
      })),
    })),
  };
}

export function toJsonString(data) {
  return JSON.stringify(data, null, 2);
}
