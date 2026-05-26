import { Account, PortfolioItem } from '@/types';

export interface AggregatedHolding {
  key: string;
  symbol?: string;
  name: string;
  totalValue: number;
  percent: number;
  perAccount: Array<{ accountId: string; accountName: string; value: number }>;
}

const FALLBACK_USD_KRW = 1350;

export function exchangeRate(from: string, to: string, usdToKrw: number = FALLBACK_USD_KRW): number {
  if (from === to) return 1;
  if (from === 'USD' && to === 'KRW') return usdToKrw;
  if (from === 'KRW' && to === 'USD') return 1 / usdToKrw;
  return 1;
}

function itemKey(item: PortfolioItem): string {
  if (item.symbol) return `S:${item.symbol.toUpperCase()}`;
  return `N:${item.name.trim().toLowerCase()}`;
}

export function sumTargetPercent(items: PortfolioItem[]): number {
  return items.reduce((acc, it) => acc + (Number(it.targetPercent) || 0), 0);
}

export function isValidAllocation(items: PortfolioItem[], tolerance = 0.01): boolean {
  if (items.length === 0) return true;
  const total = sumTargetPercent(items);
  return Math.abs(total - 100) <= tolerance;
}

/**
 * Aggregate all items across all accounts into a single distribution,
 * normalized to the requested base currency (default KRW).
 *
 * Each item's contribution = account.totalAmount * (item.targetPercent / 100),
 * converted to base currency.
 */
export function aggregateAcrossAccounts(
  accounts: Account[],
  baseCurrency: 'KRW' | 'USD' = 'KRW',
  usdToKrw: number = FALLBACK_USD_KRW,
): { totalBase: number; holdings: AggregatedHolding[] } {
  const map = new Map<string, AggregatedHolding>();
  let totalBase = 0;

  for (const acc of accounts) {
    const rate = exchangeRate(acc.currency, baseCurrency, usdToKrw);
    const accountTotalBase = acc.totalAmount * rate;
    totalBase += accountTotalBase;
    for (const item of acc.items) {
      const value = accountTotalBase * ((Number(item.targetPercent) || 0) / 100);
      const key = itemKey(item);
      const entry = map.get(key);
      const perAccount = { accountId: acc.id, accountName: acc.name, value };
      if (entry) {
        entry.totalValue += value;
        entry.perAccount.push(perAccount);
      } else {
        map.set(key, {
          key,
          symbol: item.symbol,
          name: item.name,
          totalValue: value,
          percent: 0,
          perAccount: [perAccount],
        });
      }
    }
  }

  const holdings = Array.from(map.values());
  if (totalBase > 0) {
    for (const h of holdings) {
      h.percent = (h.totalValue / totalBase) * 100;
    }
  }
  holdings.sort((a, b) => b.totalValue - a.totalValue);
  return { totalBase, holdings };
}
