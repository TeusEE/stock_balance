import { fetchQuote, fetchQuotes } from '../stockApi';

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
