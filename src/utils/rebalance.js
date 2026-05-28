import { exchangeRate } from './aggregate';

const FALLBACK_USD_KRW = 1350;

/**
 * 한 항목의 권장 매수 수량과, 보유 수량 대비 추가 매수/매도 필요량을 계산합니다.
 *
 * 반환 객체:
 *   - targetValue:     목표 금액 (계좌 통화 기준)
 *   - priceInAccount:  계좌 통화로 환산된 1주 가격
 *   - shares:          권장 매수 주식 수 (예산 초과 방지 위해 내림)
 *   - actualValue:     shares * priceInAccount (목표를 만들기 위해 처음부터 사야 할 총액)
 *   - remaining:       targetValue - actualValue (양수면 부족, 음수면 초과)
 *   - hasPrice:        가격 정보가 있어 계산이 유효한지 여부
 *   - ownedShares:     입력된 보유 수량 (없으면 null)
 *   - ownedValue:      ownedShares * priceInAccount
 *   - delta:           shares - (ownedShares ?? 0)
 *                       양수 → +delta주 추가 매수 필요
 *                       음수 → |delta|주 매도 (초과 보유)
 *                       0    → 목표 달성
 *   - additionalCost:  delta * priceInAccount (부호 그대로)
 */
export function computeItemRebalance(
  totalAmount,
  targetPercent,
  currentPrice,
  itemCurrency,
  accountCurrency,
  usdToKrw = FALLBACK_USD_KRW,
  ownedShares,
) {
  const targetValue = totalAmount * ((Number(targetPercent) || 0) / 100);
  const ownedNum =
    ownedShares != null && isFinite(Number(ownedShares)) && Number(ownedShares) >= 0
      ? Number(ownedShares)
      : null;

  if (!currentPrice || currentPrice <= 0) {
    return {
      targetValue,
      priceInAccount: 0,
      shares: 0,
      actualValue: 0,
      remaining: targetValue,
      hasPrice: false,
      ownedShares: ownedNum,
      ownedValue: 0,
      delta: 0,
      additionalCost: targetValue,
    };
  }
  const fx = exchangeRate(itemCurrency ?? accountCurrency, accountCurrency, usdToKrw);
  const priceInAccount = currentPrice * fx;
  const shares = Math.max(0, Math.floor(targetValue / priceInAccount));
  const actualValue = shares * priceInAccount;
  const remaining = targetValue - actualValue;

  const ownedForDelta = ownedNum ?? 0;
  const delta = shares - ownedForDelta;
  const ownedValue = ownedForDelta * priceInAccount;
  const additionalCost = delta * priceInAccount;

  return {
    targetValue,
    priceInAccount,
    shares,
    actualValue,
    remaining,
    hasPrice: true,
    ownedShares: ownedNum,
    ownedValue,
    delta,
    additionalCost,
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
      item.ownedShares,
    ),
  }));
  const totalTarget = items.reduce((s, i) => s + i.rebalance.targetValue, 0);
  const totalActual = items.reduce((s, i) => s + i.rebalance.actualValue, 0);
  const totalUnallocated = account.totalAmount - totalActual;
  const totalAdditionalCost = items.reduce(
    (s, i) => s + (i.rebalance.hasPrice ? i.rebalance.additionalCost : 0),
    0,
  );
  return { totalTarget, totalActual, totalUnallocated, totalAdditionalCost, items };
}
