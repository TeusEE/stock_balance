import { DEFAULT_CATEGORY, inferDefaultCategory } from '../categories';

describe('inferDefaultCategory', () => {
  test('명확한 채권 ETF는 채권형으로 분류한다', () => {
    expect(inferDefaultCategory({ shortname: 'KODEX 국고채10년', symbol: '152380.KS' })).toBe(
      'bond',
    );
    expect(inferDefaultCategory({ shortname: 'iShares 20+ Year Treasury Bond', symbol: 'TLT' })).toBe(
      'bond',
    );
  });

  test('배당 ETF는 배당투자형으로 분류한다', () => {
    expect(inferDefaultCategory({ shortname: 'SOL 미국배당다우존스', symbol: '446720.KS' })).toBe(
      'dividend',
    );
    expect(inferDefaultCategory({ shortname: 'Schwab US Dividend Equity ETF', symbol: 'SCHD' })).toBe(
      'dividend',
    );
  });

  test('금/리츠/원자재 성격은 실물형으로 분류한다', () => {
    expect(inferDefaultCategory({ shortname: 'ACE KRX금현물', symbol: '411060.KS' })).toBe(
      'physical',
    );
    expect(inferDefaultCategory({ shortname: 'TIGER 리츠부동산인프라', symbol: '329200.KS' })).toBe(
      'physical',
    );
  });

  test('현금성 상품은 현금형으로 분류한다', () => {
    expect(inferDefaultCategory({ shortname: '미국 단기금융 MMF', symbol: 'MMF' })).toBe(
      'cash',
    );
    expect(inferDefaultCategory({ shortname: 'iShares 0-3 Month Treasury Bond ETF', symbol: 'SGOV' })).toBe(
      'cash',
    );
  });

  test('일반 주식과 애매한 ETF는 기존 기본값으로 둔다', () => {
    expect(inferDefaultCategory({ shortname: '삼성전자', symbol: '005930.KS' })).toBe(
      DEFAULT_CATEGORY,
    );
    expect(inferDefaultCategory({ shortname: 'TIGER 미국S&P500', symbol: '360750.KS' })).toBe(
      DEFAULT_CATEGORY,
    );
  });
});
