#!/usr/bin/env node
/*
 * 실제 Yahoo Finance 의 6개월 과거 종가를 호출해 stockApi.js 의
 * fetchHistoricalClose / fetchHistoricalCloses 를 검증하는 스크립트.
 *
 * 외부 네트워크가 되는 환경에서 실행:
 *   npm run test:live:backtest
 *
 * 기준 종목: 삼성전자 005930.KS, AAPL
 *
 * jest 가 RN fetch 폴리필을 깔아 실제 네트워크를 못 타기 때문에,
 * 라이브 검증은 jest 가 아닌 이 Node 스크립트로 한다.
 */
require('@babel/register')({
  presets: ['babel-preset-expo'],
  plugins: [['module-resolver', { root: ['./'], alias: { '@': './src' } }]],
  extensions: ['.js', '.jsx'],
  cache: false,
});

const {
  fetchHistoricalClose,
  fetchHistoricalCloses,
} = require('../src/services/stockApi');

const SAMSUNG = '005930.KS';
const APPLE = 'AAPL';

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

  console.log(`\n실제 Yahoo Finance 6개월 시리즈 검증 (기준: ${SAMSUNG}, ${APPLE})\n`);

  console.log(`[1] fetchHistoricalClose('${SAMSUNG}', '6mo')`);
  let s = null;
  try {
    s = await fetchHistoricalClose(SAMSUNG, '6mo');
  } catch (e) {
    console.error('  ✗ 호출 실패:', e.message);
    failures++;
  }
  if (!s) {
    console.error('  ✗ 시리즈를 받지 못했습니다');
    failures++;
  } else {
    const startDate = new Date(s.startTs * 1000).toISOString().slice(0, 10);
    const endDate = new Date(s.endTs * 1000).toISOString().slice(0, 10);
    const ret = ((s.endClose - s.startClose) / s.startClose) * 100;
    console.log(`     → ${startDate}: ${s.startClose.toLocaleString()} ${s.currency}`);
    console.log(`     → ${endDate}: ${s.endClose.toLocaleString()} ${s.currency}`);
    console.log(`     → 6개월 수익률: ${ret.toFixed(2)}%`);
    check(typeof s.startClose === 'number' && s.startClose > 0, '시작 종가 양수');
    check(typeof s.endClose === 'number' && s.endClose > 0, '종료 종가 양수');
    check(s.currency === 'KRW', '통화가 KRW');
    check(s.endTs > s.startTs, '종료 시각 > 시작 시각');
  }

  console.log(`\n[2] fetchHistoricalCloses(['${SAMSUNG}', '${APPLE}', 'NOPE.X'], '6mo')`);
  const map = await fetchHistoricalCloses([SAMSUNG, APPLE, 'NOPE.X'], '6mo');
  check(!!map[SAMSUNG], '삼성전자 시리즈 반환');
  check(!!map[APPLE], 'AAPL 시리즈 반환');
  check(map['NOPE.X'] === undefined, '잘못된 심볼은 결과에서 제외');
  if (map[APPLE]) {
    const ret = ((map[APPLE].endClose - map[APPLE].startClose) / map[APPLE].startClose) * 100;
    console.log(`     → AAPL 6개월 수익률: ${ret.toFixed(2)}% (${map[APPLE].currency})`);
  }

  console.log('');
  if (failures > 0) {
    console.error(
      `라이브 검증 실패 ${failures}건 — 외부 네트워크가 차단된 환경(예: CI/샌드박스) 또는 ` +
        '응답 형식이 바뀌었을 수 있습니다.',
    );
    process.exit(1);
  }
  console.log('모든 라이브 검증 통과 ✅');
}

main().catch((e) => {
  console.error('오류:', e.message);
  process.exit(1);
});
