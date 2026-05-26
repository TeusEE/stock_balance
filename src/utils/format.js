export function formatCurrency(amount, currency = 'KRW') {
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

export function formatPercent(value, fractionDigits = 2) {
  if (!isFinite(value)) return '-';
  return `${value.toFixed(fractionDigits)}%`;
}

export function genId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
