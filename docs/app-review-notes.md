# App Review Information — Notes (paste-ready, v1.2.0)

이 파일은 App Store Connect 의 **App Review Information → Notes** 필드에 붙여넣는 영문 원본입니다.
아래 **코드블록 안의 내용만** 복사해서 Notes 칸에 넣으세요(한글 설명 제외).

> ⚠️ Notes 4000자 제한 — 아래 본문은 약 3,300자라 제한 안에 들어갑니다.
> ⚠️ **v1.2.0 = 선택적 공유(서버 전송) 첫 도입.** 제출 전 ① 처리방침(`privacy-policy.md`, 공유 내용 포함)이 라이브인지,
> ② App Privacy 설문을 아래 가이드대로 갱신했는지 확인하세요.

---

```
ABOUT THIS BUILD (v1.2.0)
This update adds an OPTIONAL portfolio-sharing feature. No in-app purchases, no ads, and no permission prompts (no camera/location/contacts/tracking/notifications). The core app still works fully offline with no account.

1) WHAT'S NEW IN 1.2.0
An optional "Share Portfolio" feature lets a user publish ONLY their portfolio weights (security name, ticker, category, target %) so others can view them via a share code or in a public "Browse" tab with a 6-month-return ranking. Amounts, owned share counts, current prices, and total assets are NEVER sent.

2) ACCOUNTS / AUTH
Browsing the app, viewing market data, and viewing shared portfolios require NO login. Only PUBLISHING requires a lightweight account = a self-chosen nickname + password. We do NOT collect email, phone, or any social login (passwords are bcrypt-hashed on our server; we do not use a hosted auth provider). The same nickname+password lets a user manage (edit/delete) their own shares from any device. No email means no reset email.

3) USER-GENERATED CONTENT — MODERATION (Guideline 1.2)
Shared portfolios and nicknames are user-generated content. We provide: an EULA / "no objectionable content" agreement required before first publish; a REPORT control on every shared item; a BLOCK-author action; a profanity filter on nickname/title; automatic hiding once a report threshold is reached, plus manual review. Moderation/abuse contact: xodn1311@gmail.com.

4) TESTED DEVICES & iOS VERSIONS
- iPhone 16, iOS 26.5

5) APP PURPOSE & TARGET AUDIENCE
A personal portfolio tracking and rebalancing calculator for retail investors who hold stocks/ETFs across multiple brokerage accounts: declare each account's total and holdings with target weights, fetch current prices from public market data, compute whole-number shares to buy/sell to hit each target weight, view a consolidated allocation, run a 6-month historical backtest, and OPTIONALLY share weights. Informational/analytical only: no investment advice, no trade execution, no custody, no payments. Primary locale: Korean.

6) EXTERNAL SERVICES
- Naver stock search (https://m.stock.naver.com/front-api/search) — security search; sends only the search text.
- Yahoo Finance chart (https://query1.finance.yahoo.com/v8/finance/chart/{symbol}) — price/currency and historical closes; sends only the ticker.
- Supabase (https://zbjpvtrwdiuihuzkhkye.supabase.co) — backend for the OPTIONAL Share feature only; stores nickname, a bcrypt-hashed password, portfolio weights, a random user id, and a computed 6-month return. Protected by Row Level Security.
No IAP, no ads, no analytics/attribution/crash SDK, no tracking.

7) REGIONAL CONSISTENCY
Behavior is identical in all regions; the UI is Korean. Yahoo Finance covers global markets via ticker suffixes (e.g., 005930.KS KOSPI, AAPL NASDAQ). Nothing is region-locked.

8) REGULATED INDUSTRY / THIRD-PARTY MATERIAL
A personal-finance information and calculation tool. No brokerage/custodial/fiduciary license, no individualized advice (only target-weight arithmetic and historical weighted-return reporting), no trade execution, no fees. Market data comes from public endpoints serving publicly available quotes. The app bundles no licensed third-party text/image/audio/video.

Privacy policy: https://teusee.github.io/stock_balance/privacy-policy.html
Support / moderation contact: xodn1311@gmail.com
```

---

## App Privacy 설문 갱신 (1.2.0 — Data Not Collected → 수집 신고)

> 1.1.0 까지는 모두 "Data Not Collected" 였지만, **1.2.0 부터 공유 기능으로 서버 전송이 시작**되므로 아래로 갱신.

**수집 신고 항목** (모두 Linked, **추적 아님**, 용도 = App Functionality / Account Management):
- **Identifiers → User ID**: 랜덤 user id
- **User Content → Other User Content**: 별명, 공유 포트폴리오(종목+비중), 제목

**미수집 유지**: 이메일/전화/주소(Contact Info), 위치, 연락처, 카메라/사진, 추적용 식별자.
- 비밀번호는 우리 DB에 **bcrypt 해시**로 저장하는 인증 자격증명(추적/광고 용도 아님).
- 광고·분석·어트리뷰션·크래시 SDK 없음. **App Tracking Transparency 대상 아님.**

**근거**: 공유는 사용자가 명시적으로 "포트폴리오 공유"를 누를 때만 전송. 금액/보유수량/현재가는 전송 안 함(비중만).
