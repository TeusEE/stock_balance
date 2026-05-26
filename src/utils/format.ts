import { Currency } from '@/types';

export function formatCurrency(amount: number, currency: Currency | string = 'KRW'): string {
  if (!isFinite(amount)) return '-';
  const locale = currency === 'USD' ? 'en-US' : 'ko-KR';
  const fractionDigits = currency === 'USD' ? 2 : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

export function formatPercent(value: number, fractionDigits = 2): string {
  if (!isFinite(value)) return '-';
  return `${value.toFixed(fractionDigits)}%`;
}

export function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
