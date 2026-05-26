const SEARCH_URL = 'https://query2.finance.yahoo.com/v1/finance/search';
const QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';

/**
 * Yahoo Finance로 주식/ETF를 검색합니다.
 * - 미국: AAPL, VOO 등
 * - 한국: 005930.KS, 091160.KQ 등 (한글 종목명도 검색 가능)
 */
export async function searchStocks(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `${SEARCH_URL}?q=${encodeURIComponent(trimmed)}&quotesCount=10&newsCount=0`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Search failed: ${res.status}`);
  }
  const data = await res.json();
  const quotes = data.quotes ?? [];
  return quotes
    .filter((q) => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF'))
    .map((q) => ({
      symbol: q.symbol,
      shortname: q.shortname ?? q.symbol,
      longname: q.longname,
      exchange: q.exchange,
    }));
}

export async function fetchQuotes(symbols) {
  if (symbols.length === 0) return {};
  const url = `${QUOTE_URL}?symbols=${encodeURIComponent(symbols.join(','))}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Quote fetch failed: ${res.status}`);
  }
  const data = await res.json();
  const result = data.quoteResponse?.result ?? [];
  const out = {};
  for (const q of result) {
    out[q.symbol] = {
      symbol: q.symbol,
      shortname: q.shortName ?? q.symbol,
      longname: q.longName,
      exchange: q.fullExchangeName,
      currency: q.currency,
      price: q.regularMarketPrice,
      marketState: q.marketState,
    };
  }
  return out;
}

export async function fetchQuote(symbol) {
  const map = await fetchQuotes([symbol]);
  return map[symbol] ?? null;
}
