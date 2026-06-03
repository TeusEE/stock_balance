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

/**
 * USD→KRW 현재 환율을 Yahoo Finance에서 가져옵니다. (USDKRW=X 심볼)
 * 실패 시 null을 반환합니다.
 */
export async function fetchExchangeRate(from = 'USD', to = 'KRW') {
  const symbol = `${from}${to}=X`;
  const url = `${CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const data = await res.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  return typeof price === 'number' ? price : null;
}

// ───────────────────────────────────────────────────────────────────
// 백테스트용 과거 시세 (v2)
// ───────────────────────────────────────────────────────────────────

/**
 * v8 chart 응답에서 일별 종가 시리즈를 파싱합니다.
 *
 * - 배당/분할 조정 종가(`indicators.adjclose`)가 있으면 우선 사용하고,
 *   없으면 `indicators.quote[0].close` 로 폴백합니다. (v2.1 — 배당 일부 반영)
 * - closes 배열에는 휴장일 등으로 중간에 null 이 섞일 수 있어, 유효한
 *   (timestamp, close) 쌍만 남긴 전체 시리즈를 함께 반환합니다.
 * - `startClose`/`endClose` 는 시리즈의 첫/마지막 값에서 파생됩니다 (v2.0 호환).
 *
 * 반환: { symbol, currency, startClose, endClose, startTs, endTs,
 *         timestamps[], closes[] } 또는 null (유효 종가 2개 미만)
 */
export function parseChartSeries(data, requestedSymbol) {
  const result = data?.chart?.result?.[0];
  const meta = result?.meta;
  const timestamps = result?.timestamp;
  const adjCloses = result?.indicators?.adjclose?.[0]?.close;
  const quoteCloses = result?.indicators?.quote?.[0]?.close;
  const rawCloses = Array.isArray(adjCloses) ? adjCloses : quoteCloses;
  if (!meta || !Array.isArray(timestamps) || !Array.isArray(rawCloses)) return null;
  if (timestamps.length === 0 || rawCloses.length === 0) return null;

  const validTs = [];
  const validCloses = [];
  const len = Math.min(timestamps.length, rawCloses.length);
  for (let i = 0; i < len; i++) {
    const c = rawCloses[i];
    if (typeof c === 'number' && isFinite(c) && typeof timestamps[i] === 'number') {
      validTs.push(timestamps[i]);
      validCloses.push(c);
    }
  }
  if (validCloses.length < 2) return null;

  return {
    symbol: meta.symbol ?? requestedSymbol,
    currency: meta.currency,
    startClose: validCloses[0],
    endClose: validCloses[validCloses.length - 1],
    startTs: validTs[0],
    endTs: validTs[validTs.length - 1],
    timestamps: validTs,
    closes: validCloses,
  };
}

/**
 * 한 심볼의 6개월(기본) 일별 종가 시리즈에서 첫·끝 유효 종가를 가져옵니다.
 * 실패 시 null.
 */
export async function fetchHistoricalClose(symbol, range = '6mo') {
  const url = `${CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&range=${encodeURIComponent(
    range,
  )}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Historical fetch failed: ${res.status}`);
  }
  const data = await res.json();
  return parseChartSeries(data, symbol);
}

/**
 * 여러 심볼의 과거 종가 시리즈를 병렬로 가져옵니다.
 * `fetchQuotes` 와 동일하게 일부 심볼 실패는 무시하고 성공한 것만 맵으로 반환.
 */
export async function fetchHistoricalCloses(symbols, range = '6mo') {
  if (!symbols || symbols.length === 0) return {};
  const entries = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const series = await fetchHistoricalClose(symbol, range);
        return series ? [symbol, series] : null;
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
