import { DEFAULT_CATEGORY } from '@/constants/categories';

const FALLBACK_USD_KRW = 1350;

export function exchangeRate(from, to, usdToKrw = FALLBACK_USD_KRW) {
  if (from === to) return 1;
  if (from === 'USD' && to === 'KRW') return usdToKrw;
  if (from === 'KRW' && to === 'USD') return 1 / usdToKrw;
  return 1;
}

function itemKey(item) {
  if (item.symbol) return `S:${item.symbol.toUpperCase()}`;
  return `N:${item.name.trim().toLowerCase()}`;
}

export function sumTargetPercent(items) {
  return items.reduce((acc, it) => acc + (Number(it.targetPercent) || 0), 0);
}

export function isValidAllocation(items, tolerance = 0.01) {
  if (items.length === 0) return true;
  const total = sumTargetPercent(items);
  return Math.abs(total - 100) <= tolerance;
}

/**
 * 모든 계좌의 항목들을 하나의 분포로 합산합니다.
 * 같은 심볼(또는 같은 이름)이면 한 항목으로 통합되며,
 * 통화가 다르면 KRW/USD로 환산해서 합칩니다.
 *
 * 각 항목의 기여도 = 계좌 총금액 * (비중 / 100) → baseCurrency로 환산
 */
export function aggregateAcrossAccounts(
  accounts,
  baseCurrency = 'KRW',
  usdToKrw = FALLBACK_USD_KRW,
) {
  const map = new Map();
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

/**
 * 모든 계좌의 항목들을 카테고리별로 그룹화해 합산합니다.
 * 각 그룹은 해당 카테고리에 속한 항목들의 합계를 가집니다.
 */
export function aggregateByCategory(
  accounts,
  baseCurrency = 'KRW',
  usdToKrw = FALLBACK_USD_KRW,
) {
  const map = new Map();
  let totalBase = 0;

  for (const acc of accounts) {
    const rate = exchangeRate(acc.currency, baseCurrency, usdToKrw);
    const accountTotalBase = acc.totalAmount * rate;
    totalBase += accountTotalBase;
    for (const item of acc.items) {
      const value = accountTotalBase * ((Number(item.targetPercent) || 0) / 100);
      const catKey = item.category || DEFAULT_CATEGORY;
      const entry = map.get(catKey);
      const holding = {
        key: itemKey(item),
        symbol: item.symbol,
        name: item.name,
        value,
        accountName: acc.name,
      };
      if (entry) {
        entry.totalValue += value;
        entry.holdings.push(holding);
      } else {
        map.set(catKey, {
          key: catKey,
          category: catKey,
          totalValue: value,
          percent: 0,
          holdings: [holding],
        });
      }
    }
  }

  const groups = Array.from(map.values());
  if (totalBase > 0) {
    for (const g of groups) {
      g.percent = (g.totalValue / totalBase) * 100;
      for (const h of g.holdings) {
        h.percent = totalBase > 0 ? (h.value / totalBase) * 100 : 0;
      }
    }
  }
  groups.sort((a, b) => b.totalValue - a.totalValue);
  return { totalBase, groups };
}
