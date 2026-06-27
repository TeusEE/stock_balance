// App Store 스크린샷 캡처용 데모 모드.
//
// 이 모듈은 프로덕션 동작에 영향을 주지 않습니다. `EXPO_PUBLIC_SCREENSHOT_SCENE`
// 환경변수가 설정된 경우에만 활성화되며(= 데모 시드 데이터 + 지정된 화면 상태),
// 환경변수가 없으면 SCREENSHOT_ENABLED 가 false 라 모든 분기가 무시됩니다.
//
// 사용법은 scripts/screenshots.sh 참고. 직접 띄워 보려면:
//   EXPO_PUBLIC_SCREENSHOT_SCENE=browse npx expo start

export const SCENE = process.env.EXPO_PUBLIC_SCREENSHOT_SCENE || null;
export const SCREENSHOT_ENABLED = !!SCENE;

// 캡처할 씬 목록 (scripts/screenshots.sh 와 동일해야 함)
export const SCENES = [
  'account',
  'consolidated',
  'browse',
];

const DEMO_ACCOUNT_ID = 'acc_demo_1';
const USD_ACCOUNT_ID = 'acc_demo_3';

// 시드 데이터 — process.env 외 시간 의존성을 없애기 위해 고정 타임스탬프 사용.
// (현재가/환율 갱신 시각 표시에만 쓰임)
const SEED_TS = 1748700000000; // 고정값: 자동 새로고침(네트워크) 방지 + 결정적 캡처

const item = (over) => ({
  symbol: undefined,
  currentPrice: undefined,
  currency: 'KRW',
  category: 'growth',
  ownedShares: undefined,
  manual: false,
  lastPriceUpdatedAt: SEED_TS,
  ...over,
});

export const SEED_RATE = { usdToKrw: 1378.5, updatedAt: SEED_TS };

const SEED_ACCOUNTS = [
  {
    id: DEMO_ACCOUNT_ID,
    name: '키움 ISA',
    totalAmount: 10000000,
    currency: 'KRW',
    createdAt: SEED_TS,
    items: [
      item({ id: 'i_1_1', name: 'TIGER 미국S&P500', symbol: '360750.KS', currentPrice: 18500, targetPercent: 25, category: 'growth', ownedShares: 100 }),
      item({ id: 'i_1_2', name: '삼성전자', symbol: '005930.KS', currentPrice: 78000, targetPercent: 20, category: 'growth', ownedShares: 20 }),
      item({ id: 'i_1_3', name: 'SOL 미국배당다우존스', symbol: '446720.KS', currentPrice: 11200, targetPercent: 20, category: 'dividend', ownedShares: 200 }),
      item({ id: 'i_1_4', name: 'KODEX 국고채10년', symbol: '152380.KS', currentPrice: 52000, targetPercent: 15, category: 'bond', ownedShares: 28 }),
      item({ id: 'i_1_5', name: 'ACE KRX금현물', symbol: '411060.KS', currentPrice: 14800, targetPercent: 10, category: 'physical', ownedShares: 50 }),
      item({ id: 'i_1_6', name: '현금', targetPercent: 10, category: 'cash', manual: true }),
    ],
  },
  {
    id: 'acc_demo_2',
    name: '미래에셋 IRP',
    totalAmount: 20000000,
    currency: 'KRW',
    createdAt: SEED_TS,
    items: [
      item({ id: 'i_2_1', name: 'TIGER 미국나스닥100', symbol: '133690.KS', currentPrice: 105000, targetPercent: 35, category: 'growth', ownedShares: 50 }),
      item({ id: 'i_2_2', name: 'ACE 미국빅테크TOP7', symbol: '465580.KS', currentPrice: 25000, targetPercent: 20, category: 'growth', ownedShares: 180 }),
      item({ id: 'i_2_3', name: 'KODEX 종합채권', symbol: '273130.KS', currentPrice: 105000, targetPercent: 20, category: 'bond', ownedShares: 38 }),
      item({ id: 'i_2_4', name: 'TIGER 리츠부동산인프라', symbol: '329200.KS', currentPrice: 5200, targetPercent: 15, category: 'physical', ownedShares: 500 }),
      item({ id: 'i_2_5', name: '현금', targetPercent: 10, category: 'cash', manual: true }),
    ],
  },
  {
    id: USD_ACCOUNT_ID,
    name: '키움 해외주식',
    totalAmount: 50000,
    currency: 'USD',
    createdAt: SEED_TS,
    items: [
      item({ id: 'i_3_1', name: 'Vanguard S&P 500 ETF', symbol: 'VOO', currentPrice: 545, currency: 'USD', targetPercent: 40, category: 'growth', ownedShares: 30 }),
      item({ id: 'i_3_2', name: 'Schwab US Dividend Equity ETF', symbol: 'SCHD', currentPrice: 28.5, currency: 'USD', targetPercent: 30, category: 'dividend', ownedShares: 600 }),
      item({ id: 'i_3_3', name: 'iShares 20+ Year Treasury Bond', symbol: 'TLT', currentPrice: 88, currency: 'USD', targetPercent: 20, category: 'bond', ownedShares: 113 }),
      item({ id: 'i_3_4', name: '현금 (USD)', targetPercent: 10, category: 'cash', currency: 'USD', manual: true }),
    ],
  },
];

export const SEED_STATE = {
  activeAccountId: DEMO_ACCOUNT_ID,
  accounts: SEED_ACCOUNTS,
};

export const SEED_BROWSE_PORTFOLIOS = [
  {
    id: 'share_demo_1',
    user_id: 'user_demo_1',
    nickname: '배당든든',
    title: '월배당 안정형 포트폴리오',
    base_currency: 'KRW',
    return_6m: 18.42,
    holdings: [
      { name: 'SCHD', symbol: 'SCHD', category: 'dividend', targetPercent: 35 },
      { name: 'SOL 미국배당다우존스', symbol: '446720.KS', category: 'dividend', targetPercent: 25 },
      { name: 'KODEX 국고채10년', symbol: '152380.KS', category: 'bond', targetPercent: 25 },
      { name: '현금', category: 'cash', targetPercent: 15 },
    ],
  },
  {
    id: 'share_demo_2',
    user_id: 'user_demo_2',
    nickname: '장기성장러',
    title: '미국 빅테크 성장 조합',
    base_currency: 'KRW',
    return_6m: 15.77,
    holdings: [
      { name: 'TIGER 미국나스닥100', symbol: '133690.KS', category: 'growth', targetPercent: 40 },
      { name: 'ACE 미국빅테크TOP7', symbol: '465580.KS', category: 'growth', targetPercent: 30 },
      { name: 'TIGER 미국S&P500', symbol: '360750.KS', category: 'growth', targetPercent: 20 },
      { name: '현금', category: 'cash', targetPercent: 10 },
    ],
  },
  {
    id: 'share_demo_3',
    user_id: 'user_demo_3',
    nickname: '균형투자자',
    title: '성장·채권 균형형',
    base_currency: 'KRW',
    return_6m: 9.63,
    holdings: [
      { name: 'VOO', symbol: 'VOO', category: 'growth', targetPercent: 35 },
      { name: 'KODEX 종합채권', symbol: '273130.KS', category: 'bond', targetPercent: 30 },
      { name: 'ACE KRX금현물', symbol: '411060.KS', category: 'physical', targetPercent: 20 },
      { name: '현금', category: 'cash', targetPercent: 15 },
    ],
  },
  {
    id: 'share_demo_4',
    user_id: 'user_demo_4',
    nickname: '연금준비',
    title: 'IRP 장기 분산 포트폴리오',
    base_currency: 'KRW',
    return_6m: 7.28,
    holdings: [
      { name: 'TIGER 미국S&P500', symbol: '360750.KS', category: 'growth', targetPercent: 30 },
      { name: 'TIGER 리츠부동산인프라', symbol: '329200.KS', category: 'physical', targetPercent: 20 },
      { name: 'KODEX 국고채10년', symbol: '152380.KS', category: 'bond', targetPercent: 35 },
      { name: '현금', category: 'cash', targetPercent: 15 },
    ],
  },
  {
    id: 'share_demo_5',
    user_id: 'user_demo_5',
    nickname: '초보분산',
    title: '처음 시작하는 4종목 분산',
    base_currency: 'KRW',
    return_6m: 5.91,
    holdings: [
      { name: '삼성전자', symbol: '005930.KS', category: 'growth', targetPercent: 25 },
      { name: 'TIGER 미국S&P500', symbol: '360750.KS', category: 'growth', targetPercent: 35 },
      { name: 'KODEX 종합채권', symbol: '273130.KS', category: 'bond', targetPercent: 25 },
      { name: '현금', category: 'cash', targetPercent: 15 },
    ],
  },
];

// 씬별 화면 상태 -------------------------------------------------------------

// 시작 탭: 통합 화면 씬이면 'Consolidated', 그 외엔 'Accounts'
export function screenshotInitialTab() {
  if (SCENE === 'consolidated') {
    return 'Consolidated';
  }
  if (SCENE === 'browse') return 'Browse';
  return 'Accounts';
}

// 통합 화면 보기 모드
export function screenshotConsolidatedViewMode() {
  return 'symbol';
}

export function screenshotConsolidatedExpanded() {
  return {};
}

// 계좌 화면에서 '항목 편집' 모달을 펼친 상태로 캡처할지
export function screenshotEditorOpen() {
  return false;
}
