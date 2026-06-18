function round2(n) {
  const v = Number(n);
  if (!isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

/**
 * 로컬 포트폴리오를 공유용 페이로드로 변환합니다.
 *
 * ⚠️ 비중·종목 메타(name/symbol/category/targetPercent)만 포함하며,
 *    금액(totalAmount)·보유수량(ownedShares)·현재가(currentPrice) 등 민감 정보는
 *    절대 포함하지 않습니다. 서버(Supabase)로 나가는 단일 출처이므로 이 규칙은 강제됩니다.
 *
 * @param title        공유 제목
 * @param baseCurrency 'KRW' | 'USD'
 * @param holdings     [{ name, symbol?, category?, targetPercent | percent }]
 *                     단일 계좌 항목(targetPercent) 또는 통합 holdings(percent) 모두 허용
 * @returns { title, base_currency, holdings: [{ name, symbol, category, targetPercent }] }
 */
export function toSharePayload({ title, baseCurrency, holdings } = {}) {
  return {
    title: String(title ?? '').trim(),
    base_currency: baseCurrency === 'USD' ? 'USD' : 'KRW',
    holdings: (Array.isArray(holdings) ? holdings : []).map((h) => ({
      name: String(h?.name ?? '').trim(),
      symbol: h?.symbol ?? null,
      category: h?.category ?? null,
      // 단일 계좌는 targetPercent, 통합 holdings는 percent 를 사용한다.
      targetPercent: round2(Number(h?.targetPercent ?? h?.percent) || 0),
    })),
  };
}
