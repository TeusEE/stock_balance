import { Account, PortfolioItem } from '@/types';
import { exchangeRate } from './aggregate';

const FALLBACK_USD_KRW = 1350;

export interface ItemRebalance {
  /** 해당 항목이 목표 비중으로 차지해야 하는 금액 (계좌 통화 기준) */
  targetValue: number;
  /** 계좌 통화로 환산된 1주 가격 */
  priceInAccount: number;
  /** 목표 금액에 근접하기 위해 매수해야 할 수량 (예산 초과를 막기 위해 내림) */
  shares: number;
  /** shares × priceInAccount — 실제 매수에 들 금액 */
  actualValue: number;
  /** targetValue - actualValue — 남는(부족한) 금액 */
  remaining: number;
  /** 가격 정보가 있어 계산이 유효한지 여부 */
  hasPrice: boolean;
}

export function computeItemRebalance(
  totalAmount: number,
  targetPercent: number,
  currentPrice: number | undefined,
  itemCurrency: string | undefined,
  accountCurrency: 'KRW' | 'USD',
  usdToKrw: number = FALLBACK_USD_KRW,
): ItemRebalance {
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

export interface AccountRebalanceSummary {
  totalTarget: number;
  totalActual: number;
  totalUnallocated: number;
  items: Array<{ item: PortfolioItem; rebalance: ItemRebalance }>;
}

export function computeAccountRebalance(
  account: Account,
  usdToKrw: number = FALLBACK_USD_KRW,
): AccountRebalanceSummary {
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
