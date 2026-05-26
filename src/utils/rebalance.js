import { exchangeRate } from './aggregate';

const FALLBACK_USD_KRW = 1350;

/**
 * 한 항목의 권장 매수 수량을 계산합니다.
 *
 * 반환 객체:
 *   - targetValue:    목표 금액 (계좌 통화 기준)
 *   - priceInAccount: 계좌 통화로 환산된 1주 가격
 *   - shares:         권장 매수 주식 수 (예산 초과 방지 위해 내림)
 *   - actualValue:    shares * priceInAccount (실제 매수 금액)
 *   - remaining:      targetValue - actualValue (양수면 부족, 음수면 초과)
 *   - hasPrice:       가격 정보가 있어 계산이 유효한지 여부
 */
export function computeItemRebalance(
  totalAmount,
  targetPercent,
  currentPrice,
  itemCurrency,
  accountCurrency,
  usdToKrw = FALLBACK_USD_KRW,
) {
  const targetValue = totalAmount * ((Number(targetPercent) || 0) / 100);
  if (!currentPrice || currentPrice <= 0) {
    return {
      targetValue,
      priceInAccount: 0,
      shares: 0,
      actualValue: 0,
      remaining: targetValue,
      hasPrice: false,
    };
  }
  const fx = exchangeRate(itemCurrency ?? accountCurrency, accountCurrency, usdToKrw);
  const priceInAccount = currentPrice * fx;
  const shares = Math.max(0, Math.floor(targetValue / priceInAccount));
  const actualValue = shares * priceInAccount;
  const remaining = targetValue - actualValue;
  return {
    targetValue,
    priceInAccount,
    shares,
    actualValue,
    remaining,
    hasPrice: true,
  };
}

export function computeAccountRebalance(account, usdToKrw = FALLBACK_USD_KRW) {
  const items = account.items.map((item) => ({
    item,
    rebalance: computeItemRebalance(
      account.totalAmount,
      item.targetPercent,
      item.currentPrice,
      item.currency,
      account.currency,
      usdToKrw,
    ),
  }));
  const totalTarget = items.reduce((s, i) => s + i.rebalance.targetValue, 0);
  const totalActual = items.reduce((s, i) => s + i.rebalance.actualValue, 0);
  const totalUnallocated = account.totalAmount - totalActual;
  return { totalTarget, totalActual, totalUnallocated, items };
}
