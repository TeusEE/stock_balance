import { StockQuote } from '@/types';

const SEARCH_URL = 'https://query2.finance.yahoo.com/v1/finance/search';
const QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';

type YahooSearchQuote = {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  quoteType?: string;
};

type YahooQuote = {
  symbol: string;
  shortName?: string;
  longName?: string;
  fullExchangeName?: string;
  currency?: string;
  regularMarketPrice?: number;
  marketState?: string;
};

/**
 * Search stocks/ETFs via Yahoo Finance.
 * Supports US tickers (e.g. AAPL, VOO) and Korean tickers (e.g. 005930.KS, 091160.KQ).
 * Korean users can also search by Korean name (e.g. "삼성전자").
 */
export async function searchStocks(query: string): Promise<StockQuote[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `${SEARCH_URL}?q=${encodeURIComponent(trimmed)}&quotesCount=10&newsCount=0`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Search failed: ${res.status}`);
  }
  const data = (await res.json()) as { quotes?: YahooSearchQuote[] };
  const quotes = data.quotes ?? [];
  return quotes
    .filter((q) => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF'))
    .map<StockQuote>((q) => ({
      symbol: q.symbol,
      shortname: q.shortname ?? q.symbol,
      longname: q.longname,
      exchange: q.exchange,
    }));
}

export async function fetchQuotes(symbols: string[]): Promise<Record<string, StockQuote>> {
  if (symbols.length === 0) return {};
  const url = `${QUOTE_URL}?symbols=${encodeURIComponent(symbols.join(','))}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Quote fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as { quoteResponse?: { result?: YahooQuote[] } };
  const result = data.quoteResponse?.result ?? [];
  const out: Record<string, StockQuote> = {};
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

export async function fetchQuote(symbol: string): Promise<StockQuote | null> {
  const map = await fetchQuotes([symbol]);
  return map[symbol] ?? null;
}
