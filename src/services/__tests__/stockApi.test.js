import {
  fetchHistoricalClose,
  fetchHistoricalCloses,
  fetchQuote,
  fetchQuotes,
  parseChartSeries,
} from '../stockApi';

// 실제 삼성전자(005930.KS) v8 chart 응답을 본뜬 mock.
// regularMarketPrice 는 2026-05-27 기준 실제 시세(307,000원)를 반영.
function samsungChartResponse() {
  return {
    chart: {
      result: [
        {
          meta: {
            currency: 'KRW',
            symbol: '005930.KS',
            exchangeName: 'KSC',
            instrumentType: 'EQUITY',
            regularMarketPrice: 307000,
            chartPreviousClose: 299000,
            shortName: 'Samsung Electronics',
          },
        },
      ],
      error: null,
    },
  };
}

function okResponse(json) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(json) });
}

function errorResponse(status) {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('fetchQuotes (삼성전자 현재가 조회)', () => {
  test('삼성전자 현재가와 통화를 정상적으로 파싱한다', async () => {
    global.fetch = jest.fn(() => okResponse(samsungChartResponse()));

    const result = await fetchQuotes(['005930.KS']);

    expect(result['005930.KS']).toBeDefined();
    expect(result['005930.KS'].price).toBe(307000);
    expect(result['005930.KS'].currency).toBe('KRW');
    expect(result['005930.KS'].symbol).toBe('005930.KS');
  });

  test('인증이 필요 없는 v8 chart 엔드포인트를 호출한다 (v7 quote 아님)', async () => {
    global.fetch = jest.fn(() => okResponse(samsungChartResponse()));

    await fetchQuotes(['005930.KS']);

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('/v8/finance/chart/005930.KS');
    expect(calledUrl).not.toContain('/v7/finance/quote');
  });

  test('한 종목이 실패(403)해도 나머지 성공한 종목은 반환한다', async () => {
    global.fetch = jest.fn((url) => {
      if (String(url).includes('005930.KS')) return okResponse(samsungChartResponse());
      return errorResponse(403);
    });

    const result = await fetchQuotes(['005930.KS', 'BADSYMBOL']);

    expect(result['005930.KS'].price).toBe(307000);
    expect(result['BADSYMBOL']).toBeUndefined();
  });

  test('빈 배열이면 네트워크 호출 없이 빈 객체를 반환한다', async () => {
    global.fetch = jest.fn();
    const result = await fetchQuotes([]);
    expect(result).toEqual({});
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('fetchQuote (단일 종목)', () => {
  test('삼성전자 단일 조회 시 시세 객체를 반환한다', async () => {
    global.fetch = jest.fn(() => okResponse(samsungChartResponse()));
    const quote = await fetchQuote('005930.KS');
    expect(quote).not.toBeNull();
    expect(quote.price).toBe(307000);
    expect(quote.currency).toBe('KRW');
  });

  test('가격 정보가 없으면 null 을 반환한다', async () => {
    global.fetch = jest.fn(() =>
      okResponse({ chart: { result: [{ meta: { currency: 'KRW' } }], error: null } }),
    );
    const quote = await fetchQuote('005930.KS');
    expect(quote).toBeNull();
  });
});

// 6개월 시리즈 mock — 중간에 null(휴장/결측)이 섞여 있어도 첫·끝 유효 종가를 뽑아야 함
function samsungSeriesResponse() {
  return {
    chart: {
      result: [
        {
          meta: { currency: 'KRW', symbol: '005930.KS' },
          timestamp: [1700000000, 1700086400, 1700172800, 1700259200, 1700345600],
          indicators: {
            quote: [
              { close: [null, 70000, 72000, null, 78000] },
            ],
          },
        },
      ],
      error: null,
    },
  };
}

describe('parseChartSeries (백테스트용 과거 종가)', () => {
  test('중간 null 을 건너뛰고 첫·끝 유효 종가를 추출한다', () => {
    const s = parseChartSeries(samsungSeriesResponse(), '005930.KS');
    expect(s).not.toBeNull();
    expect(s.symbol).toBe('005930.KS');
    expect(s.currency).toBe('KRW');
    expect(s.startClose).toBe(70000);
    expect(s.endClose).toBe(78000);
  });

  test('timestamps/closes 가 비었거나 모두 null 이면 null', () => {
    const empty = parseChartSeries(
      { chart: { result: [{ meta: { currency: 'KRW' }, timestamp: [], indicators: { quote: [{ close: [] }] } }] } },
      'X',
    );
    expect(empty).toBeNull();
    const allNull = parseChartSeries(
      {
        chart: {
          result: [
            {
              meta: { currency: 'KRW' },
              timestamp: [1, 2, 3],
              indicators: { quote: [{ close: [null, null, null] }] },
            },
          ],
        },
      },
      'X',
    );
    expect(allNull).toBeNull();
  });

  test('유효 (timestamp, close) 쌍만 남긴 전체 시리즈를 반환한다 (v2.1)', () => {
    const s = parseChartSeries(samsungSeriesResponse(), '005930.KS');
    // null 인 index 0, 3 이 제거된 쌍
    expect(s.timestamps).toEqual([1700086400, 1700172800, 1700345600]);
    expect(s.closes).toEqual([70000, 72000, 78000]);
    // startClose/endClose 는 시리즈 첫/끝에서 파생
    expect(s.startClose).toBe(s.closes[0]);
    expect(s.endClose).toBe(s.closes[s.closes.length - 1]);
  });

  test('adjclose(조정 종가)가 있으면 quote close 보다 우선 사용한다 (v2.1 — 배당 반영)', () => {
    const data = samsungSeriesResponse();
    data.chart.result[0].indicators.adjclose = [
      { close: [null, 69000, 71000, null, 77000] },
    ];
    const s = parseChartSeries(data, '005930.KS');
    expect(s.startClose).toBe(69000);
    expect(s.endClose).toBe(77000);
    expect(s.closes).toEqual([69000, 71000, 77000]);
  });

  test('첫 유효값과 끝 유효값이 같은 인덱스(1개뿐)면 null — 수익률 계산 불가', () => {
    const single = parseChartSeries(
      {
        chart: {
          result: [
            {
              meta: { currency: 'KRW' },
              timestamp: [1, 2, 3],
              indicators: { quote: [{ close: [null, 1000, null] }] },
            },
          ],
        },
      },
      'X',
    );
    expect(single).toBeNull();
  });
});

describe('fetchHistoricalCloses (병렬·부분실패)', () => {
  test('range=6mo&interval=1d 로 chart 엔드포인트를 호출한다', async () => {
    global.fetch = jest.fn(() => okResponse(samsungSeriesResponse()));
    await fetchHistoricalClose('005930.KS', '6mo');
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('/v8/finance/chart/005930.KS');
    expect(url).toContain('interval=1d');
    expect(url).toContain('range=6mo');
  });

  test('일부 심볼이 실패해도 성공한 심볼은 반환한다', async () => {
    global.fetch = jest.fn((url) => {
      if (String(url).includes('005930.KS')) return okResponse(samsungSeriesResponse());
      return errorResponse(404);
    });
    const map = await fetchHistoricalCloses(['005930.KS', 'NOPE.X'], '6mo');
    expect(map['005930.KS'].startClose).toBe(70000);
    expect(map['005930.KS'].endClose).toBe(78000);
    expect(map['NOPE.X']).toBeUndefined();
  });

  test('빈 배열이면 네트워크 호출 없이 빈 객체', async () => {
    global.fetch = jest.fn();
    const map = await fetchHistoricalCloses([], '6mo');
    expect(map).toEqual({});
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
