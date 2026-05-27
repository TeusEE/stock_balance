const SEARCH_URL = 'https://query2.finance.yahoo.com/v1/finance/search';
const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

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

/**
 * v8 chart 응답(meta)에서 시세 정보를 추출합니다.
 * v7 quote 엔드포인트는 crumb/쿠키 인증을 요구해 401/403으로 실패하므로,
 * 인증이 필요 없는 chart 엔드포인트의 meta를 사용합니다.
 */
function parseChartMeta(data, requestedSymbol) {
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || meta.regularMarketPrice == null) return null;
  return {
    symbol: meta.symbol ?? requestedSymbol,
    shortname: meta.shortName ?? meta.symbol ?? requestedSymbol,
    longname: meta.longName,
    exchange: meta.exchangeName ?? meta.fullExchangeName,
    currency: meta.currency,
    price: meta.regularMarketPrice,
    marketState: meta.marketState,
  };
}

async function fetchChartQuote(symbol) {
  const url = `${CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Quote fetch failed: ${res.status}`);
  }
  const data = await res.json();
  return parseChartMeta(data, symbol);
}

/**
 * 여러 심볼의 현재가를 가져옵니다. (심볼별 chart 호출을 병렬 실행)
 * 결과는 입력 심볼을 key로 갖는 맵입니다. 일부 심볼이 실패해도
 * 나머지 성공한 심볼은 그대로 반환합니다.
 */
export async function fetchQuotes(symbols) {
  if (symbols.length === 0) return {};
  const entries = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const quote = await fetchChartQuote(symbol);
        return quote ? [symbol, quote] : null;
      } catch {
        return null;
      }
    }),
  );
  const out = {};
  for (const entry of entries) {
    if (entry) out[entry[0]] = entry[1];
  }
  return out;
}

export async function fetchQuote(symbol) {
  const map = await fetchQuotes([symbol]);
  return map[symbol] ?? null;
}
