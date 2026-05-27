#!/usr/bin/env node
/*
 * 실제 Yahoo Finance를 호출해 src/services/stockApi.js 의 현재가 조회를
 * 검증하는 라이브 스크립트입니다. (Node 네이티브 fetch 사용)
 *
 * 외부 네트워크가 되는 환경에서 실행:
 *   npm run test:live
 *
 * 기준 종목: 삼성전자 005930.KS
 *
 * 주의: jest(jest-expo) 환경은 RN용 fetch 폴리필을 깔기 때문에 실제 네트워크를
 * 타지 못합니다. 그래서 라이브 검증은 jest 대신 이 Node 스크립트로 합니다.
 */
require('@babel/register')({
  presets: ['babel-preset-expo'],
  plugins: [['module-resolver', { root: ['./'], alias: { '@': './src' } }]],
  extensions: ['.js', '.jsx'],
  cache: false,
});

const { fetchQuotes, fetchQuote, searchStocks } = require('../src/services/stockApi');

const SAMSUNG = '005930.KS';

async function main() {
  let failures = 0;
  const check = (cond, msg) => {
    if (cond) {
      console.log('  ✓', msg);
    } else {
      console.error('  ✗', msg);
      failures++;
    }
  };

  console.log(`\n실제 Yahoo Finance 호출 검증 (기준: 삼성전자 ${SAMSUNG})\n`);

  console.log("[1] fetchQuotes(['005930.KS'])");
  const map = await fetchQuotes([SAMSUNG]);
  const q = map[SAMSUNG];
  if (!q) {
    console.error('  ✗ 응답을 받지 못했습니다 (네트워크 또는 엔드포인트 확인 필요)');
    failures++;
  } else {
    console.log(`     → 삼성전자 현재가: ${q.price?.toLocaleString()} ${q.currency}`);
    check(typeof q.price === 'number' && q.price > 0, '가격이 양수');
    check(q.currency === 'KRW', '통화가 KRW');
    check(q.symbol === SAMSUNG, '심볼 일치');
  }

  console.log("[2] fetchQuote('005930.KS') 단일 조회");
  const single = await fetchQuote(SAMSUNG);
  check(!!single && single.price > 0, '단일 조회 가격이 양수');

  console.log("[3] searchStocks('삼성전자') 검색");
  try {
    const results = await searchStocks('삼성전자');
    check(
      Array.isArray(results) && results.some((r) => r.symbol === SAMSUNG),
      '검색 결과에 005930.KS 포함',
    );
  } catch (e) {
    console.error('  ✗ 검색 호출 실패:', e.message);
    failures++;
  }

  console.log('[4] fetchQuotes([삼성, 잘못된 심볼]) 부분 실패 처리');
  const partial = await fetchQuotes([SAMSUNG, 'NOSUCH.TICKER.XYZ']);
  check(!!partial[SAMSUNG], '삼성전자는 정상 반환');
  check(partial['NOSUCH.TICKER.XYZ'] === undefined, '잘못된 심볼은 결과에서 제외');

  console.log('');
  if (failures > 0) {
    console.error(
      `라이브 검증 실패 ${failures}건 — 외부 네트워크가 차단된 환경(예: CI/샌드박스)이거나 ` +
        'Yahoo 응답 형식이 바뀌었을 수 있습니다.',
    );
    process.exit(1);
  }
  console.log('모든 라이브 검증 통과 ✅');
}

main().catch((e) => {
  console.error('오류:', e.message);
  process.exit(1);
});
