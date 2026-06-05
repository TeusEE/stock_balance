# App Review Information — Notes (paste-ready)

이 파일은 App Store Connect 의
**App Review Information → Notes** 필드에 붙여넣는 영문 원본입니다.
아래 **코드블록 안의 내용만** 복사해서 Notes 칸에 넣으세요(한글 설명은 제외).

> ⚠️ Notes 필드는 **4000자 제한**이 있습니다. 아래 본문은 약 **3,300자**라
> 제한 안에 들어갑니다. 디바이스/URL 은 이미 채워져 있으니 그대로 복사하면 됩니다.

기존 리젝션 사유: **Guideline 2.1 — Information Needed**.
응답은 Apple 이 요청한 7개 항목을 같은 순서로 답합니다.

---

```
ABOUT THIS REPLY
No account/login, no in-app purchases, no ads, no user-generated content, and no permission prompts. Answers to the seven requested items, in order:

1) SCREEN RECORDING
A recording made on a physical iPhone (latest iOS) is attached. It shows: app launch; creating an account tab and entering a total amount; adding holdings via stock search ("삼성전자"/"VOO") and manual entry (cash); setting each target %; the donut chart, 100% validation, and recommended-shares card; the Consolidated tab with symbol/group toggle; the 6-month backtest result modal (hold/weekly/monthly/quarterly); and JSON export via the OS share sheet. There is no registration/login/account-deletion flow, no paid content, and no prompt for camera, location, contacts, tracking, or notifications.

2) TESTED DEVICES & iOS VERSIONS
- iPhone 16, iOS 26.5

3) APP PURPOSE & TARGET AUDIENCE
Stock Balance is a personal portfolio tracking and rebalancing calculator for retail investors who hold stocks/ETFs across multiple brokerage accounts. It lets the user declare each account's total and holdings with target weights, fetch current prices from a public market-data endpoint, compute the whole-number shares to buy/sell to reach each target weight, view a consolidated allocation across accounts, and run a 6-month historical backtest. It is informational/analytical only: it gives no investment advice, executes no trades, holds no assets, processes no payments, and collects no user data. Primary locale: Korean.

4) SETUP & ACCESS — NO LOGIN REQUIRED
All data is stored on-device via standard AsyncStorage. No account, login, or demo credentials. First use: launch -> "+ 탭 추가" (add account) -> enter name and total -> "+ 항목 추가" (add item) -> "검색" (search by ticker/name; price and currency auto-fill) or type a name manually -> enter target % (donut updates live; warns if total is not 100%) -> see recommended shares -> "Consolidated" tab merges all accounts (symbol/group views).

5) EXTERNAL SERVICES
One external service, read-only and unauthenticated: Yahoo Finance public endpoints
- https://query2.finance.yahoo.com/v1/finance/search
- https://query1.finance.yahoo.com/v8/finance/chart/{symbol}
Used to search securities, fetch current price/currency, and fetch historical daily closes for the backtest. No auth services, API keys, payment processors, AI/ML, analytics, ad SDKs, crash reporters, or own backend.

6) REGIONAL CONSISTENCY
Behavior is identical in all regions. The UI is Korean for this release, but all features work worldwide. Yahoo Finance covers global markets via ticker suffixes (e.g., "005930.KS" KOSPI, "AAPL" NASDAQ); nothing is region-locked and there are no country-specific gates.

7) REGULATED INDUSTRY / THIRD-PARTY MATERIAL
This is a personal-finance information and calculation tool. It holds no brokerage/custodial/fiduciary license, gives no individualized advice (only target-weight arithmetic and historical weighted-return reporting), executes no trades, and charges no fees. Market data comes from Yahoo Finance's public endpoint serving publicly available quotes. The app bundles no licensed third-party text/image/audio/video.

Privacy policy: https://teusee.github.io/stock_balance/privacy-policy.html
Support contact: xodn1311@gmail.com
```

---

## 보조: App Privacy 설문 답변 가이드

App Store Connect → App Privacy 에서 데이터 수집 항목을 묻습니다.
이 앱은 모든 항목에 **"Data Not Collected"** 로 답할 수 있습니다.
근거:
- 권한 요청 0건 (`src/` 어디에도 `Permissions*` / `expo-camera`/`expo-location` 등 import 없음)
- 외부 호스트는 Yahoo Finance 1곳뿐, 어떤 식별자도 전송 안 함
- 모든 사용자 데이터는 AsyncStorage 로컬 저장
