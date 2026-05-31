# App Store 스크린샷 캡처 가이드

App Store 제출용 스크린샷을 **데모 데이터로 채워진 화면**에서 자동으로 캡처합니다.
화면 상태와 시드 데이터는 모두 코드로 관리되므로, 매 배포 때마다 동일한 화면을 재현할 수 있습니다.

---

## TL;DR

```bash
./scripts/screenshots.sh
```

→ `screenshots/01~05-*.png` (1320×2868, App Store 6.9" 필수 규격) 생성.

---

## 요구사항

| 항목 | 비고 |
|---|---|
| macOS + Xcode | iOS 시뮬레이터 포함 |
| iOS 시뮬레이터 | 기본값 `iPhone 17 Pro Max` (6.9" = 1320×2868) |
| Node + npm | `npm install` 선행 |
| CocoaPods | **최초 1회 빌드 시에만** 필요 (`expo run:ios`) |

> 앱이 시뮬레이터에 설치돼 있지 않으면 스크립트가 `expo run:ios`로 자동 빌드합니다.
> 최초 빌드는 수 분 걸리며 CocoaPods가 필요합니다. 두 번째 실행부터는 빌드를 건너뜁니다.

---

## 사용법

### 전체 캡처

```bash
./scripts/screenshots.sh
```

### 특정 씬만 캡처

```bash
./scripts/screenshots.sh consolidated-group
./scripts/screenshots.sh account usd        # 여러 개 지정 가능
```

### 다른 디바이스로 캡처

```bash
DEVICE="iPhone 16 Pro Max" ./scripts/screenshots.sh      # 6.9"
DEVICE="iPhone 14 Plus"    ./scripts/screenshots.sh      # 6.5" (1242×2688, 선택 규격)
```

사용 가능한 시뮬레이터 목록:

```bash
xcrun simctl list devices available | grep iPhone
```

### 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `DEVICE` | `iPhone 17 Pro Max` | 캡처에 사용할 시뮬레이터 이름 |
| `BUNDLE_ID` | `com.stockbalance.app` | 앱 번들 ID (`app.json`과 일치) |
| `OUT_DIR` | `./screenshots` | 출력 디렉토리 |
| `METRO_PORT` | `8081` | Metro 번들러 포트 |

---

## 캡처되는 5개 씬

| 씬 키 | 출력 파일 | 화면 | 강조 포인트 |
|---|---|---|---|
| `account` | `01-account-rebalance.png` | 계좌 리밸런싱 (키움 ISA) | 비중 도넛 100%, 권장 매수 총액, 보유→목표 델타 |
| `consolidated-symbol` | `02-consolidated-symbol.png` | 통합 · 종목별 | 전 계좌 합산 자산, 종목별 분포 |
| `consolidated-group` | `03-consolidated-group.png` | 통합 · 그룹별 | 카테고리(성장/배당/채권/실물/현금) 분류 + 범례 |
| `editor` | `04-item-editor.png` | 항목 편집 모달 | 분류/현재가/보유수량/비중 입력 |
| `usd` | `05-usd-account.png` | USD 해외주식 계좌 | 달러 표기, VOO 등 |

---

## 동작 원리

스크린샷 전용 동작은 모두 **`EXPO_PUBLIC_SCREENSHOT_SCENE` 환경변수**로만 켜집니다.
이 변수가 없으면(=일반 실행 / 프로덕션 빌드) 시드 데이터와 씬 로직은 전부 비활성화되어
앱 동작에 **아무런 영향이 없습니다.**

```
scripts/screenshots.sh
  └─ 씬마다:  EXPO_PUBLIC_SCREENSHOT_SCENE=<씬> npx expo start --clear   (Metro 재시작)
              → simctl 로 앱 콜드 런치 → 번들 완료 대기 → simctl io screenshot
```

화면 상태 매핑은 [`src/utils/screenshot.js`](../src/utils/screenshot.js) 한 곳에 모여 있습니다:

- `SEED_STATE` / `SEED_RATE` — 데모 계좌·종목·환율 시드 데이터
- `screenshotInitialTab()` — 씬별 시작 탭 (계좌 / 통합)
- `screenshotConsolidatedViewMode()` / `screenshotConsolidatedExpanded()` — 통합 화면 모드
- `screenshotEditorOpen()` — 항목 편집 모달 자동 오픈 여부

각 화면 컴포넌트에는 `SCREENSHOT_ENABLED` 가드만 얇게 추가되어 있습니다
(`PortfolioContext.js`, `AppNavigator.js`, `AccountScreen.js`, `ConsolidatedScreen.js`).
스크린샷 모드에서는 시세 자동 새로고침도 꺼져 **시드 가격이 고정**되므로 결과가 항상 동일합니다.

### 한 화면만 손으로 띄워 보기

```bash
EXPO_PUBLIC_SCREENSHOT_SCENE=consolidated-group npx expo start
```

---

## 새로운 씬 추가하기

1. `src/utils/screenshot.js`
   - `SCENES` 배열에 새 키 추가
   - 필요한 헬퍼(`screenshotInitialTab()` 등)에 분기 추가
   - (해당 화면에 새 상태가 필요하면) 컴포넌트에 `SCREENSHOT_ENABLED` 가드 추가
2. `scripts/screenshots.sh`
   - `SCENES=(...)` 배열에 키 추가
   - `out_file_for()` case 문에 파일명 매핑 추가

---

## 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| `사용 가능한 '...' 시뮬레이터를 찾지 못했습니다` | `DEVICE` 이름 오타. `xcrun simctl list devices available`로 확인 |
| 흰 화면이 캡처됨 | 번들 대기 시간 부족 — 스크립트의 `sleep 5`를 늘리거나 재실행 |
| 빌드가 매번 다시 돔 | `ios/`가 `.gitignore`에 있어 정상. 앱이 시뮬레이터에 남아 있으면 빌드를 건너뜀 |
| 가격/환율이 실시간 값으로 바뀜 | 스크린샷 모드에서는 자동 새로고침이 꺼져 있어야 정상. `SCREENSHOT_ENABLED` 가드 확인 |
| 상태바에 직전 앱(‹ ...) 표시 | 스크립트는 `simctl launch` 대신 dev-client URL로 콜드 런치해 이를 방지함 |
