const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

// 종목 검색은 네이버 주식 자동완성을 사용한다.
// Yahoo 검색 엔드포인트는 UA 없는 요청을 429로 차단하고 한글명 검색이 불안정하지만,
// 네이버 자동완성은 한국주식(한글명)·미국주식(티커/한글명)·ETF를 한 번에 찾아주고
// 종목코드를 돌려준다. 그 코드를 Yahoo 심볼로 매핑해 시세는 Yahoo chart 로 가져온다.
const NAVER_SEARCH_URL = 'https://ac.stock.naver.com/ac';

// Yahoo Finance는 브라우저 같은 User-Agent 가 없는 요청을 429(Too Many Requests)로
// 차단한다. 실측: UA 가 없으면 chart 가 429, 브라우저 UA 를 붙이면 200 으로 응답함.
// 모든 호출에 공통 헤더를 적용한다.
const REQUEST_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

// 네이버 자동완성용 헤더 (Referer 를 함께 보내 차단 가능성을 낮춘다)
const NAVER_HEADERS = {
  ...REQUEST_HEADERS,
  Referer: 'https://m.stock.naver.com/',
};

/**
 * 네이버 자동완성 항목(code/typeCode/nationCode)을 Yahoo Finance 심볼로 변환한다.
 * - 한국 KOSPI(한국 ETF 포함): `{code}.KS`
 * - 한국 KOSDAQ:               `{code}.KQ`
 * - 미국(NASDAQ/NYSE/AMEX):    `{code}` (접미사 없음)
 * - 그 외: best-effort 로 `{code}` 그대로 (Yahoo 에서 해석 못 하면 시세 없음 처리)
 * 매핑할 수 없으면 null.
 */
export function toYahooSymbol(item) {
  if (!item || !item.code) return null;
  const code = String(item.code).trim();
  if (!code) return null;
  const nation = item.nationCode;
  const type = item.typeCode;
  if (nation === 'KOR') {
    if (type === 'KOSDAQ') return `${code}.KQ`;
    if (type === 'KOSPI') return `${code}.KS`;
    return null; // KONEX 등 Yahoo 미지원 시장은 제외
  }
  // 미국 및 그 외 해외: 티커 코드를 그대로 사용
  return code;
}

/**
 * 네이버 주식 자동완성으로 종목/ETF를 검색합니다.
 * - 한국: "삼성전자", "에코프로비엠", "KODEX 200" 등 한글명·코드
 * - 미국: "AAPL", "애플", "VOO" 등 티커·한글명
 * 반환 형태는 기존과 동일: { symbol(=Yahoo 심볼), shortname, longname, exchange }
 */
export async function searchStocks(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `${NAVER_SEARCH_URL}?q=${encodeURIComponent(trimmed)}&target=stock,etf`;
  const res = await fetch(url, { headers: NAVER_HEADERS });
  if (!res.ok) {
    throw new Error(`Search failed: ${res.status}`);
  }
  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  return items
    .map((it) => {
      const symbol = toYahooSymbol(it);
      if (!symbol) return null;
      return {
        symbol,
        shortname: it.name ?? symbol,
        longname: it.name ?? undefined,
        exchange: it.typeName ?? it.typeCode,
      };
    })
    .filter(Boolean);
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
  const res = await fetch(url, { headers: REQUEST_HEADERS });
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
  const res = await fetch(url, { headers: REQUEST_HEADERS });
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
  const res = await fetch(url, { headers: REQUEST_HEADERS });
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
