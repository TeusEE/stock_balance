import { toSharePayload } from '../shareSerialize';

describe('toSharePayload — 비중만 추출 (민감정보 미포함)', () => {
  const items = [
    {
      name: '삼성전자',
      symbol: '005930.KS',
      category: '국내주식',
      targetPercent: 40,
      currentPrice: 70000,
      ownedShares: 10,
      currency: 'KRW',
      manual: false,
    },
    { name: '현금', targetPercent: 60, manual: true },
  ];

  test('금액/보유수량/현재가 등 민감 키가 절대 포함되지 않는다', () => {
    const payload = toSharePayload({ title: '내 포트폴리오', baseCurrency: 'KRW', holdings: items });
    const json = JSON.stringify(payload);
    for (const forbidden of [
      'totalAmount',
      'ownedShares',
      'currentPrice',
      'perAccount',
      'totalValue',
      'manual',
    ]) {
      expect(json).not.toContain(forbidden);
    }
    // 각 holding 의 키는 정확히 4개(name/symbol/category/targetPercent)만 허용
    for (const h of payload.holdings) {
      expect(Object.keys(h).sort()).toEqual(['category', 'name', 'symbol', 'targetPercent']);
    }
  });

  test('name/symbol/category/targetPercent 매핑 + title trim', () => {
    const payload = toSharePayload({ title: '  내 포트폴리오  ', baseCurrency: 'KRW', holdings: items });
    expect(payload.title).toBe('내 포트폴리오');
    expect(payload.base_currency).toBe('KRW');
    expect(payload.holdings[0]).toEqual({
      name: '삼성전자',
      symbol: '005930.KS',
      category: '국내주식',
      targetPercent: 40,
    });
    expect(payload.holdings[1]).toEqual({
      name: '현금',
      symbol: null,
      category: null,
      targetPercent: 60,
    });
  });

  test('통합 holdings 의 percent 를 targetPercent 로 흡수 (소수 둘째자리 반올림)', () => {
    const consolidated = [
      { name: '애플', symbol: 'AAPL', percent: 33.333 },
      { name: '구글', symbol: 'GOOGL', percent: 66.667 },
    ];
    const payload = toSharePayload({ title: 't', baseCurrency: 'USD', holdings: consolidated });
    expect(payload.base_currency).toBe('USD');
    expect(payload.holdings[0].targetPercent).toBe(33.33);
    expect(payload.holdings[1].targetPercent).toBe(66.67);
    expect(payload.holdings[0].category).toBeNull();
  });

  test('빈/누락 입력에도 안전', () => {
    expect(toSharePayload()).toEqual({ title: '', base_currency: 'KRW', holdings: [] });
    expect(toSharePayload({ title: 'x', baseCurrency: 'KRW' }).holdings).toEqual([]);
    // 알 수 없는 통화는 KRW 로 폴백
    expect(toSharePayload({ baseCurrency: 'EUR', holdings: [] }).base_currency).toBe('KRW');
  });
});
