# App Review Information — Notes (paste-ready)

이 파일은 App Store Connect 의
**App Review Information → Notes** 필드에 붙여넣는 영문 원본입니다.
`[FILL IN]` 자리표시자 2곳(테스트한 디바이스 목록, 처리방침 URL)만
실제 값으로 채워서 그대로 복사하세요.

기존 리젝션 사유: **Guideline 2.1 — Information Needed**.
응답은 Apple 이 요청한 7개 항목을 같은 순서로 답합니다.

---

```
ABOUT THIS REPLY
This app has no account/login system, no in-app purchases, no ads,
no user-generated content, and no permission prompts. The reply
below addresses each of the seven items in the order requested.

1) SCREEN RECORDING
A screen recording captured on a physical iPhone running the latest
iOS is attached separately. It covers, in order:
  - App launch
  - Creating a new account tab and entering the total amount
  - Adding portfolio items via stock search ("삼성전자" / "VOO")
    and via manual entry (cash)
  - Setting target percentage for each item; viewing the donut chart,
    target-allocation validation, and the recommended-shares card
  - Switching to the Consolidated tab and toggling between
    symbol view and category-group view
  - Tapping "6-month backtest" and viewing the result modal
    (with the holding / weekly / monthly / quarterly rebalance modes)
  - Exporting the portfolio as JSON via the OS share sheet
The app has no account registration / login / account deletion flow,
no paid content or in-app purchases, no user-generated content, and
prompts for no device capability or sensitive data (no camera,
location, contacts, App Tracking Transparency, or notifications).

2) TESTED DEVICES & iOS VERSIONS
[FILL IN — example:
 - iPhone 16 Pro Max, iOS 18.x
 - iPhone 14, iOS 17.x
 - iPad Air 13-inch (M2), iPadOS 18.x ]

3) APP PURPOSE & TARGET AUDIENCE
Stock Balance is a personal portfolio tracking and rebalancing
calculator for individual investors who hold stocks/ETFs across
multiple brokerage accounts.

Problem: When an investor splits assets across several brokerage
accounts (e.g., Korean ISA + retirement IRP + a U.S. brokerage),
it is difficult to see the true total allocation, and even harder
to decide how many additional shares to buy or sell to bring each
holding back to its target weight.

Value: The app lets the user
  - declare each account with a total amount and a list of holdings
    with target weights,
  - automatically retrieve current prices from a public market-data
    endpoint,
  - compute the exact whole-number shares to buy or sell to reach
    each target weight,
  - view a consolidated, deduplicated allocation across all accounts,
  - and run a 6-month historical backtest (buy-and-hold or periodic
    rebalancing) on the current target weights.

Target audience: retail investors who self-manage diversified
portfolios (primary release locale: Korean).

This app is an informational and analytical tool. It does NOT
provide investment advice, execute or transmit trades, hold custody
of any assets, process payments or subscriptions, or collect or
transmit any user data.

4) SETTING UP & ACCESSING MAIN FEATURES — NO LOGIN REQUIRED
The app stores all data on-device only, using iOS' standard
AsyncStorage. There is no account creation, no login, and no demo
credentials are needed.

Typical first-use flow:
  1. Launch the app — the "Accounts" tab opens.
  2. Tap "+ 탭 추가" (Add tab) to create a new account.
  3. Type the account name (e.g., "Brokerage A") and total amount.
  4. Tap "+ 항목 추가" (Add item) and either:
       - Tap "검색" (Search) and search by ticker or name
         (e.g., "AAPL", "VOO", "삼성전자"); the current price and
         currency are auto-filled from the selected result, OR
       - Type a name manually (for cash or unlisted holdings).
  5. Enter the target percentage. The donut chart updates live, and
     a warning appears if the total is not 100%.
  6. The screen shows the recommended whole-share count to buy for
     each holding.
  7. Switch to the "Consolidated" tab to see the allocation merged
     across all accounts; toggle Symbol / Group views.

5) EXTERNAL SERVICES USED
Only one external service is used, read-only and unauthenticated:

  Yahoo Finance public endpoints
    - https://query2.finance.yahoo.com/v1/finance/search
    - https://query1.finance.yahoo.com/v8/finance/chart/{symbol}

It is used to: (a) search for stocks/ETFs by ticker or name,
(b) retrieve the current market price and currency for a selected
security, and (c) retrieve historical daily close prices for the
six-month backtest feature.

The app uses NO authentication services, NO API keys, NO payment
processors, NO AI/ML services, NO analytics or attribution SDKs,
NO advertising SDKs, NO crash reporters that transmit user data,
and runs NO backend server of its own.

6) REGIONAL CONSISTENCY
The app functions consistently across all regions. The user
interface is localized in Korean for the initial release, but all
features (search, prices, rebalancing, backtest, JSON export) are
available to users worldwide. Yahoo Finance covers global markets
via ticker suffixes (e.g., "005930.KS" for KOSPI, "AAPL" for
NASDAQ); results are not region-locked. There are no country-
specific feature gates.

7) REGULATED INDUSTRY / THIRD-PARTY PROTECTED MATERIAL
Stock Balance is a personal-finance information and calculation
tool. It holds no brokerage, custodial, or fiduciary license; it
provides no individualized investment advice (only pure target-
weight arithmetic and historical, weight-weighted return reporting);
it executes no trades; it charges no fees.

Market data is sourced from Yahoo Finance's public chart endpoint,
which serves publicly available market quotes accessible to any
HTTP client. The app does not bundle any text, image, audio,
or video content from a third party that requires licensing.

Privacy policy: [FILL IN — e.g., https://teusee.github.io/stock_balance/privacy-policy.html]
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
