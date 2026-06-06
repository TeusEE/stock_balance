# 한글 종목 검색 해결 계획 — 네이버 자동완성 + Yahoo 시세

> 상태: **설계 확정 / 구현 대기**
> 작성: 2026-06-06 · 관련 커밋: `93a73c2`(Yahoo UA 헤더 수정)

## 배경 (왜 필요한가)
주 사용자가 한국인인데 `삼성전자` 같은 **한글 검색이 "결과 없음"으로 실패**한다.
직접 테스트로 확인한 근본 원인:

- **Yahoo Finance 검색 엔드포인트가 브라우저 UA/쿠키/crumb 없는 요청을 HTTP 429로 차단**한다.
- 영문 `AAPL` 도 동일하게 429 → **한글 문제가 아니라 Yahoo 차단 문제**.
- 시세용 `chart` 엔드포인트는 **User-Agent만 붙이면 200**으로 동작 (이미 `REQUEST_HEADERS`로 적용, `93a73c2`).
- 검색 모달이 실패를 "검색 결과가 없습니다"로 오인 표시하던 것도 수정됨(`93a73c2`).

## 해결 방향
검색을 **네이버 주식 자동완성 API**로 전환한다. 한 엔드포인트로 한국주식(한글명)·
미국주식(티커+한글명)·ETF가 모두 검색되고 종목코드를 돌려준다. 그 코드를
**Yahoo 심볼(.KS/.KQ)** 로 매핑해 **시세·과거시세는 기존 Yahoo(UA 적용됨)** 로 가져온다.
→ 검색=네이버, 시세=Yahoo 하이브리드.

### 검증된 네이버 엔드포인트 (실측 2026-06-06)
```
GET https://ac.stock.naver.com/ac?q=<검색어>&target=stock,etf
헤더: User-Agent(브라우저) + Accept: application/json + Referer: https://m.stock.naver.com/
```
응답 `data.items[]` = `{ code, name, typeCode, typeName, nationCode, category }`

| 검색어 | 결과 |
|---|---|
| `삼성전자` | code=005930, typeCode=KOSPI, nationCode=KOR |
| `에코프로비엠` | code=247540, typeCode=KOSDAQ |
| `AAPL` / `애플` | code=AAPL, typeCode=NASDAQ, nationCode=USA |
| `KODEX 200` / `TIGER 미국S&P500` | typeCode=KOSPI (한국 ETF) |

### 코드 → Yahoo 심볼 매핑 (확정)
| nationCode | typeCode | Yahoo 심볼 |
|---|---|---|
| KOR | KOSPI (한국 ETF 포함) | `{code}.KS` |
| KOR | KOSDAQ | `{code}.KQ` |
| USA | NASDAQ/NYSE/AMEX | `{code}` (접미사 없음) |
| 그 외 | — | best-effort: `{code}` (해석 안 되면 시세 없음 처리) |

## 구현 작업

### 1. `src/services/stockApi.js` — 검색을 네이버로 교체
- 상수: `NAVER_SEARCH_URL = 'https://ac.stock.naver.com/ac'`
- `NAVER_HEADERS` = 기존 `REQUEST_HEADERS` + `Referer: 'https://m.stock.naver.com/'`
- 순수함수 `toYahooSymbol({ code, typeCode, nationCode })` 추가(위 매핑표, `export` 하여 단위테스트)
- `searchStocks(query)` 내부 재작성:
  - `?q=<encodeURIComponent(query)>&target=stock,etf` 호출
  - `data.items` 순회 → `toYahooSymbol` 로 심볼 생성(매핑 실패 항목 제외)
  - **반환 형태는 기존과 동일** 유지: `{ symbol, shortname: name, longname: name, exchange: typeName }`
    → 소비처(`StockSearchModal.handleSelect`, `ItemEditorModal.handleSelectStock`) 무변경.
      시세/통화는 선택 후 `fetchQuote(symbol)` 가 Yahoo chart meta 에서 채움.
  - 실패 시 throw (모달이 에러 표시 — "결과 없음" 오인은 이미 수정됨)
- Yahoo 검색용 `SEARCH_URL`/관련 코드는 제거. **시세·환율·과거시세 함수는 변경 없음**
  (`fetchChartQuote`, `fetchExchangeRate`, `fetchHistoricalClose` — 이미 UA 적용됨).

### 2. 테스트 `src/services/__tests__/stockApi.test.js`
기존 패턴(`global.fetch` mock, `okResponse`) 그대로 사용:
- 네이버 mock 응답으로 `searchStocks('삼성전자')` → `005930.KS` 매핑 검증
- KOSDAQ → `.KQ`, USA → 접미사 없는 코드 검증
- 호출 URL 이 `ac.stock.naver.com/ac` 이고 `q=` 인코딩됨 검증
- `toYahooSymbol` 단위테스트(KOSPI/KOSDAQ/USA/미지원)

### 3. 심사·문서 업데이트 (외부 호스트 1곳 추가됨 — 2.1 재제출 정확성)
- `docs/app-review-notes.md` 의 `5) EXTERNAL SERVICES` 에 네이버 자동완성 추가
  (read-only, unauthenticated, 사용자 데이터 미전송). **추가 후 4000자 제한 재확인**
  (현재 ~3,300자 → 여유 있음).
- `docs/privacy-policy.md` "External network requests" 에 `ac.stock.naver.com` 한 줄 추가
  (익명·검색어만 전송, 개인정보 없음).
- `CHANGELOG.md` [Unreleased] 에 "한글 검색: 네이버 자동완성 전환" 추가.

## 리스크 / 메모
- 네이버 자동완성은 **비공식 API** — Yahoo와 같은 부류의 변경/차단 리스크. 완화책:
  명확한 에러 UX(완료) + `Referer`/UA 헤더.
- **향후 강건화 옵션(범위 밖)**: KOSPI/KOSDAQ 전종목 마스터 JSON 을 앱에 내장해
  오프라인 폴백 검색 제공(차단 불가). 미국주식 한글검색은 불가해지므로 폴백 한정.
- 시세는 여전히 Yahoo(UA) 의존 — chart 엔드포인트 200 확인됨.
- 한국·미국 외 국가는 best-effort(코드 그대로). 주 사용자 대상(KR/US) 충족.

## 검증 절차
1. `npx jest` — 신규/기존 테스트 통과
2. 실기기/정상 네트워크 검색 확인:
   `삼성전자`, `삼성`, `에코프로비엠`, `애플`, `AAPL`, `VOO`, `KODEX 200`
   → 결과 표시 → 선택 시 가격/통화 자동 입력(Yahoo chart) → 비중·백테스트 동작
3. 선택 후 권장 매수 주수 계산 / 6개월 백테스트가 `.KS`·`.KQ` 심볼로 정상 동작 확인
