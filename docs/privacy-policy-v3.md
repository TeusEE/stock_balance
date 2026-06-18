---
title: Privacy Policy — Stock Balance (v3 draft)
---

<!--
  ⚠️ 이것은 v3.0(공유 기능 / 앱 버전 1.2.0)용 처리방침 초안입니다.
  현재 라이브 정책은 `privacy-policy.md`(1.1.0, "데이터 미수집") 입니다.
  1.2.0 제출 시 이 내용을 `privacy-policy.md` 로 옮겨 GitHub Pages 에 게시하세요.
  (1.1.0 가 살아있는 동안에는 라이브 정책을 바꾸지 않습니다.)
-->

# Privacy Policy — Stock Balance

_Last updated: (1.2.0 제출 시 날짜로 갱신)_

Stock Balance ("the app") is a personal portfolio tracking and rebalancing
calculator. By default it stores all your data **only on your device**. The
app collects personal data **only if you choose to use the optional
"Share Portfolio" feature.**

## Local data (default — no account needed)

All portfolio data you enter — account names, total amounts, holdings,
target percentages, current prices, owned share counts — is stored
**only on your device** using iOS' standard `AsyncStorage`, and is never
transmitted. Uninstalling the app removes this data.

Browsing the app and viewing market data require **no account and no login.**

## Optional Share feature (data sent to our server)

If you tap **"Share Portfolio"**, the following is sent to and stored on our
backend (Supabase) so your shared portfolio can be viewed by people you give
the share code to:

- **Nickname** you choose (publicly shown on the shared item).
- **Password** you set — stored only as a **bcrypt hash**, never in plaintext,
  used solely to let you manage your own shared items from any device.
- **Portfolio weights only**: security name, ticker, category, and target
  percentage. We do **NOT** send amounts, owned share counts, current prices,
  or total assets.
- A randomly generated user identifier.

We do **not** collect your email, phone number, or any tracking/advertising
identifier. The app shows no ads and integrates no analytics or advertising SDK.

### Your control over shared data
You can **unpublish** (delete) a shared portfolio at any time, which removes it
from our server. To delete your account data, contact us at the address below.

### User-generated content & moderation
Shared portfolios and nicknames are user-generated content. You can **report**
inappropriate content and **block** an author from within the app. Reported
content is reviewed and removed when warranted; content exceeding a report
threshold is automatically hidden pending review.

## External network requests

In addition to the Share backend above, the app makes anonymous,
unauthenticated HTTPS requests to public market-data endpoints:

- `https://m.stock.naver.com/front-api/search` — security search (sends only your search text).
- `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}` — price/currency and historical closes (sends only the chosen ticker).
- `https://<project>.supabase.co` — the Share backend described above (only when you use the Share feature).

## Children's privacy

The app is not directed at children under 13 and does not knowingly collect
data from children.

## Changes to this policy

If we update this policy, the new version will be posted at this same URL with
an updated "Last updated" date.

## Contact

Questions, or requests to delete your shared/account data:
**xodn1311@gmail.com**
