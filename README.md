# Stock Balance

주식 / ETF 포트폴리오를 계좌별로 구성하고 리밸런싱할 수 있는 React Native (Expo) 앱입니다.
iOS(아이폰)와 Android(갤럭시) 모두에서 동작합니다.

## 주요 기능

- **계좌 탭 동적 추가** — 상단의 "＋ 탭 추가" 버튼으로 여러 계좌를 만들 수 있습니다.
- **계좌별 설정**
  - 계좌 이름
  - 총 금액 (KRW / USD 선택)
  - 구성 종목 추가 (검색 또는 직접 입력)
  - 각 종목별 목표 비중(%)
  - 모든 항목의 비중 합이 100%가 되도록 시각적으로 안내 (남은 비중 / 초과 경고)
- **실제 주식·ETF 검색** — Yahoo Finance를 통해 종목을 검색하고 현재가/통화를 자동으로 가져옵니다.
  - 미국: `AAPL`, `VOO`, `SPY` 등
  - 한국: `005930.KS`(삼성전자), `091160.KQ` 또는 한글 종목명(예: `삼성전자`)
- **모든 계좌 통합 뷰**
  - 도넛 차트와 리스트로 종목별 전체 비중 확인
  - 동일 종목(심볼 또는 동일 이름)은 자동으로 합산
  - KRW / USD 기준 환산 표시
- **자동 저장** — AsyncStorage에 자동 저장되어 앱을 다시 열어도 데이터가 유지됩니다.
- **권장 매수 수량 계산 (리밸런싱)**
  - 각 항목의 목표 금액 = `총 금액 × 비중`
  - 권장 주식 수 = `floor(목표 금액 ÷ 현재가)` — 예산 초과를 막기 위해 내림
  - 예) 5,000원을 채워야 하는데 종목이 300원이면 → **16주** (실제 매수 4,800원, 부족 200원)
  - 계좌 전체 "예상 현금 잔액"도 표시
  - 계좌 통화 ≠ 종목 통화일 경우 환율로 자동 환산
- **가격 자동 갱신** — 계좌를 처음 열 때 5분 이상 지난 가격을 자동으로 다시 가져옵니다.

## 화면 구성

```
하단 탭
 ├─ 💼 계좌  : 계좌 추가/편집, 항목 추가/비중 설정 (상단 가로 스크롤 탭으로 계좌 전환)
 └─ 📊 통합  : 모든 계좌를 합쳐 종목별 비중을 한눈에
```

## 실행 방법

### 1) 의존성 설치

```bash
npm install
```

### 2) 개발 서버 실행

```bash
npx expo start
```

표시되는 QR 코드를 스마트폰의 **Expo Go** 앱에서 스캔하면 바로 실행할 수 있습니다.

- iOS: App Store에서 `Expo Go` 설치
- Android: Play 스토어에서 `Expo Go` 설치

### 3) 네이티브 빌드 (선택)

- iOS 시뮬레이터: `npm run ios`
- Android 에뮬레이터: `npm run android`

## 프로젝트 구조

> 전체 JavaScript로 작성되어 있습니다. (TypeScript 사용 안 함)

```
.
├── App.js                           # 진입점
├── app.json                         # Expo 설정
├── babel.config.js                  # @/* 경로 alias
├── jsconfig.json                    # 에디터(VS Code) 경로 자동완성용
└── src
    ├── components/
    │   ├── AccountTabsBar.js        # 동적 가로 탭 바
    │   ├── DonutChart.js            # SVG 도넛 차트
    │   ├── ItemEditorModal.js       # 항목 추가/편집 모달
    │   └── StockSearchModal.js      # 주식/ETF 검색
    ├── context/
    │   └── PortfolioContext.js      # 전역 상태 + AsyncStorage 영속화
    ├── navigation/
    │   └── AppNavigator.js
    ├── screens/
    │   ├── AccountScreen.js         # 계좌별 편집 화면
    │   └── ConsolidatedScreen.js    # 통합 뷰
    ├── services/
    │   └── stockApi.js              # Yahoo Finance 연동
    ├── utils/
    │   ├── aggregate.js             # 비중 계산/통합 로직
    │   ├── format.js
    │   ├── rebalance.js             # 권장 매수 수량 계산
    │   └── storage.js
    └── theme.js
```

## 비중 검증 규칙

- 항목별 비중은 `> 0` 이어야 합니다.
- 모든 항목 비중의 합은 **100%** 가 되어야 하며, 합이 100%가 아닐 경우 화면 상단의 "비중 합계" 영역이 주황색으로 표시되고 "남은 비중"이 안내됩니다.
- 항목 편집 시 "저장 후 남은 비중"이 미리보기 형태로 표시되며, 음수(초과)일 경우 빨간색으로 경고합니다.

## 통합 뷰의 합산 규칙

1. 각 항목의 가치 = `account.totalAmount × (item.targetPercent / 100)`
2. 통화가 다른 경우 KRW/USD 환율(임시 1,350 고정값)로 환산
3. 같은 `symbol`을 가진 항목, 또는 (symbol이 없을 경우) 같은 이름의 항목은 통합 뷰에서 하나로 합쳐 비중을 재계산합니다.

> 환율은 추후 실시간 환율 API 연동으로 쉽게 교체할 수 있도록 `src/utils/aggregate.js`의 `exchangeRate()`로 분리되어 있습니다.

## 향후 확장 아이디어

- 실시간 환율 API 연동 (exchangerate-api 등)
- 항목별 보유 수량/단가 입력 → 실제 평가금액 계산
- 목표 비중 대비 매수/매도 권장량 자동 계산
- 다크/라이트 테마 토글
- 데이터 백업/복원 (JSON export)
