# Stock Balance v2 / v3 구현 계획

> 마지막 업데이트: 2026-06-03
> 관련 문서: [`roadmap.md`](roadmap.md) · [`../progress.md`](../progress.md) · [`../README.md`](../README.md)
> 상태: **계획 단계** (아직 구현 전)

## 배경 (Context)

Stock Balance는 현재 **v1.0.0 (로컬 전용, 서버 없음)** 으로 App Store 배포 직전 단계다.
v1은 AsyncStorage에만 데이터를 저장하고 외부로 전송하지 않는다 (App Store에 "데이터 미수집" 선언됨).

> ♻️ **순서 변경 (2026-06-03):** 기존 계획의 v2(공유)와 v3(백테스트/순위판) 우선순위를 바꿨다.
> **6개월 백테스트는 서버가 필요 없는 순수 클라이언트 기능**이라 공유 인프라와 독립적으로
> 먼저 출시할 수 있기 때문이다. 재편성 결과:

- **v2 — 6개월 백테스트 수익률**: 현재 포트폴리오 구성을 6개월 전에 들고 있었다면 났을 수익률을
  **앱이 직접 계산해 표시**. 백엔드 없음(v1과 동일하게 로컬 전용, "데이터 미수집" 유지).
- **v3 — 공유 대시보드 + 순위판**: 포트폴리오를 **남들과 공유**하고, v2 백테스트 수익률 기준
  **순위판(리더보드)** 에 제출. 백엔드는 **Supabase**.

확정된 제품 결정:
1. **v2 수익률** = **클라이언트 계산** — 비중 가중, 종목 자기 통화 기준(환차익 제외, MVP).
2. **v3 인증** = Supabase 익명 로그인 + 사용자가 정한 **닉네임** (소셜 로그인은 추후).
3. **v3 공유 범위** = **비중(%)만** 공유 (총 금액·보유수량 등 민감 정보는 서버로 보내지 않음).
4. **v3 순위판 수익률** = v2가 계산한 값을 **클라이언트 제출(MVP)** — 서버 재계산은 향후 과제.

목표: v1 코드(상태 형식, 통합 합산 로직, 도넛 차트, 차트 API)를 최대한 재사용하면서
백테스트 → 공유/순위 기능을 **점진적으로 얹는** 것.

---

## v2 — 6개월 백테스트 수익률

> **백엔드 불필요.** v1과 동일하게 로컬 전용이며, Yahoo Finance `chart` 엔드포인트에
> 과거 종가 조회만 추가한다. App Store "데이터 미수집" 선언은 그대로 유지된다.

> 📐 **단계 구성:** v2는 **v2.0 기본(보유 수익률)을 먼저 완성**한 뒤, 같은 데이터를 재활용해
> **v2.1 확장(N일 주기 리밸런싱 백테스트)** 을 얹는 순서로 진행한다. v2.1은 추가 네트워크 호출이
> 없는 순수 계산 확장이므로 기본이 안정화된 후 점진적으로 추가한다.

## v2.0 (기본 · 우선 구현) — 보유(buy-and-hold) 6개월 수익률

### 수익률 모델 (클라이언트 계산)

```
종목수익률_i     = (현재종가_i − 6개월전종가_i) / 6개월전종가_i      (종목 자기 통화 기준)
정규화비중_i     = 비중_i / (제외 안 된 종목들의 비중 합)
포트폴리오수익률 = Σ ( 정규화비중_i × 종목수익률_i ) × 100  (%)
```

- **가중치**: 계좌 화면 = v1 목표 비중(`item.targetPercent`).
  통합 화면 = `aggregateAcrossAccounts(...).holdings[i].percent`(전 계좌 합산·동일심볼 통합·FX 처리됨).
- **현재/과거 종가**: 6개월 차트 시리즈(`range=6mo&interval=1d`)의 **첫 유효 종가**(6개월 전)와
  **마지막 유효 종가**(현재)를 같은 응답에서 추출 → 동일 통화·불일치 방지.
- **통화/금액 불필요**: % 수익률은 통화 무관이므로 환율 환산·보유수량·총금액이 필요 없다.
  → MVP는 **환차익 미반영**(향후 과제). 종목 자기 통화 기준 수익률을 그대로 가중.
- **결측·제외 처리**: 다음 종목은 제외하고 **남은 비중을 재정규화** + "N개 종목 제외" 경고 표시.
  - 심볼이 없는 항목(수동 입력/현금) — 조회 대상 자체가 없음
  - 상장 6개월 미만 / 조회 실패 — 6개월 전 종가 없음
- 비중 합이 100%가 아니어도 재정규화로 robust.

### 과거 시세 조회 (`src/services/stockApi.js` 확장)

`chart` 엔드포인트가 이미 `range`/`interval`을 지원하므로 **응답 파싱만 확장**하면 된다
(엔드포인트 동일, 인증 불필요). 기존 `parseChartMeta`/`fetchQuotes`(병렬·부분실패 허용) 패턴 재사용.

| 신규 함수 | 역할 |
|---|---|
| `parseChartSeries(data, symbol)` | `chart.result[0].timestamp` + `indicators.quote[0].close` 배열에서 **첫/마지막 유효 종가**(null 제외)와 `meta.currency` 추출 → `{ symbol, currency, startClose, endClose, startTs, endTs }` 또는 null |
| `fetchHistoricalClose(symbol, range='6mo')` | `CHART_URL/{symbol}?interval=1d&range=6mo` 호출 → `parseChartSeries` |
| `fetchHistoricalCloses(symbols, range='6mo')` | `fetchQuotes`와 동일한 `Promise.all` + 부분실패 무시 → `{ [symbol]: {...} }` 맵 |

### 신규 코드

| 파일 | 역할 |
|---|---|
| `src/utils/backtest.js` (신규, 순수 함수) | `buildAccountWeights(account)` / `buildConsolidatedWeights(holdings)` / `computeBacktest(weighted, priceMap)` — 비중 가중 수익률 계산 + 결측 제외 + 재정규화 |
| `src/utils/__tests__/backtest.test.js` | 정상 가중 수익률 / 제외+재정규화 / 전부 제외(null) / 음수 수익률 / 비중합≠100 (`rebalance.test.js` 스타일, mock 없음) |
| `src/components/BacktestModal.js` (신규) | 결과 상세 모달 — 열릴 때 고유 심볼로 `fetchHistoricalCloses` → 로딩 → `computeBacktest` 표시 |
| `scripts/check-historical-close.js` (신규) | `fetchHistoricalClose('005930.KS','6mo')` 라이브 검증 (`check-live-price.js` 패턴) |

`computeBacktest` 반환 형태(권장):
```
{
  totalReturnPercent,            // 종목 0개면 null
  includedWeightSum,             // 재정규화 분모
  included: [{ symbol, name, weight, normalizedWeight, stockReturnPercent }],
  excluded: [{ symbol|null, name, reason: 'no-symbol'|'no-data' }],
}
```

### 재사용 (수정 최소화)

- `src/services/stockApi.js`의 `parseChartMeta`/`fetchQuotes` — 과거 시세 파싱·병렬·부분실패 패턴.
- `src/utils/aggregate.js`의 `aggregateAcrossAccounts` — 통합 백테스트 비중 가중치.
- `src/utils/format.js`의 `formatPercent` — 수익률 % 포맷(양수 `colors.success`/음수 `colors.danger`).
- `src/components/ExportButtons.js` — 트리거 버튼 스타일(`styles.btn`/`primary`).
- `src/components/ItemEditorModal.js` — 결과 모달의 `Modal` 래퍼/스타일 패턴.

### 화면 / UI 변경

- **계좌 화면**(`src/screens/AccountScreen.js`): Rebalance Card 다음(~line 314)에 "6개월 백테스트"
  버튼 + 모달 visible 상태. `weighted = buildAccountWeights(activeAccount)`.
- **통합 화면**(`src/screens/ConsolidatedScreen.js`): Summary Card 다음(~line 96)에 버튼.
  이미 계산된 `holdings`로 `weighted = buildConsolidatedWeights(holdings)`.
- 모달: 큰 총 수익률 + 종목별(이름·비중·종목수익률) 리스트 + 제외 종목 경고.
  0개면 "백테스트할 수 있는 종목이 없습니다".
- `package.json`에 `"test:live:backtest": "node scripts/check-historical-close.js"` 추가.

---

## v2.1 (확장 · v2.0 완료 후) — N일 주기 리밸런싱 백테스트 ✅ 구현 완료

> v2.0이 "시작 시점 비중대로 사서 그대로 둔" **보유(buy-and-hold)** 수익률이라면,
> v2.1은 "**N영업일마다 목표 비중으로 되돌렸다면**(많이 오른 건 팔고 빠진 건 더 사면) 얼마였을까"를
> 추가로 계산해 **보유 vs 리밸런싱**을 나란히 보여준다. 이 앱의 정체성(목표 비중 리밸런싱)과 직결되는 확장.

### 핵심 이점 — 추가 네트워크 0

v2.0의 `chart?range=6mo&interval=1d` 응답에는 이미 **6개월 전체 일별 종가 배열**
(`timestamp[]` + `indicators.quote[0].close[]`)이 통째로 들어온다. v2.0은 그중 첫/마지막 2점만 쓴다.
v2.1은 **이미 받은 같은 응답의 나머지 점들을 쓰는 순수 계산**이다 → 추가 호출·의존성 0,
계산량은 126영업일 × 수십 종목으로 기기에서 즉시 처리.

### 시뮬레이션 모델 (가치 추적)

```
value_i  = totalStart × 정규화비중_i              # t0 초기 배분 (정규화비중은 v2.0과 동일)
매일:     value_i *= close_i[t] / close_i[t-1]    # 각 종목 평가액을 가격비로 갱신
N일마다:  total = Σ value_i; value_i = total × 정규화비중_i   # 목표 비중으로 리셋(리밸런싱)
최종수익률 = (Σ value_i) / totalStart − 1
```
- **보유(N=∞)** 는 리밸런싱을 한 번도 안 하는 경우 → v2.0 결과와 동일. 따라서 두 모델은 한 함수로 통합.
- **통화·정규화비중·제외 규칙은 v2.0과 동일** — 각 종목 자기 통화 가격비로만 시뮬레이션(환차익 제외).

### 구현 시 난점 → 권장 처리 (MVP)

| 난점 | 권장 처리 |
|---|---|
| 거래소별 휴장일 차이 (예: 005930.KS vs AAPL) | 종목별 시리즈를 **공통 날짜축으로 정렬 + 직전값 forward-fill** |
| 윈도우 시작/끝 정렬 | 포함 종목들의 **공통 구간 `[max(시작), min(끝)]`** 으로 절단 (6개월 미만은 이미 제외) |
| 환차익(FX) | v2.0과 동일하게 **제외** (정규화 공간 시뮬). 향후 과제 |
| 배당 | `indicators.adjclose[0].close`(조정 종가)가 있으면 우선 사용, 없으면 `quote[0].close` fallback |
| 거래비용·세금·최소 거래단위 | MVP 미반영(소수 주식 허용 이상화). 한계로 명시 |

### 코드 변경 (v2.0 위에 얹기)

| 파일 | 변경 |
|---|---|
| `src/services/stockApi.js` | `parseChartSeries`가 start/end 2점만이 아니라 **정렬된 전체 시리즈** 반환하도록 확장 → `{ symbol, currency, timestamps[], closes[] }`. `startClose`/`endClose`는 `series[0]`/`series[-1]`로 파생(v2.0 그대로 작동) |
| `src/utils/backtest.js` | `simulate(weighted, seriesMap, { intervalDays })` 추가 — `intervalDays: null`이면 보유(N=∞)로 v2.0 `computeBacktest` 흡수. + `alignSeries(seriesMap)` 헬퍼(공통축·forward-fill) |
| `src/utils/__tests__/backtest.test.js` | 합성 시리즈 추가: 반대로 움직이는 두 종목에서 리밸런싱 > 보유(rebalancing bonus), 단일 종목이면 보유=리밸런싱, 정렬/forward-fill, N=∞ 일치 |
| `src/components/BacktestModal.js` | 세그먼트/칩 `보유 · 매주(~5) · 매월(~21) · 매분기(~63)` 추가, 선택 모드 수익률 + **보유 대비 차이(±%p)** 표시 |

### MVP 한계 (문서화)
- 배당(adjclose 미제공 시)·거래비용·세금 미반영, 6개월·프리셋 N 고정.
- 환차익 포함은 **v2.2 에서 처리**. 임의 N 입력, 거래비용/세금 반영은 향후 과제.

### 진행 체크리스트

- [x] `parseChartSeries` 전체 시리즈(`timestamps[]`/`closes[]`) 반환 + adjclose 우선 (+ 테스트)
- [x] `backtest.js`: `alignSeries`(공통축·forward-fill·윈도우 절단) (+ 테스트)
- [x] `backtest.js`: `simulate(weighted, seriesMap, { intervalDays })` — `null`=보유 (+ 테스트: 리밸런싱 보너스 / 단일 종목 동일 / N=∞ 일치)
- [x] `BacktestModal`: 보유·매주·매월·매분기 세그먼트 + 보유 대비 ±%p 표시
- [x] 두 화면(`AccountScreen`/`ConsolidatedScreen`): fetch 1회 → 4모드 결과 캐시
- [x] `scripts/check-historical-close.js`: 시리즈 배열 검증 보강
- [x] `npm test` 전체 통과 (42개: stockApi 14 + backtest 20 + rebalance 8)
- [x] `roadmap.md` 의존 트리에 v2.1 ✅ 반영

---

## v2.2 — 환차익(FX) 포함 백테스트

> **백엔드 변화 0, 새 함수 0.** 기존 `fetchHistoricalClose` 가 FX 심볼(`USDKRW=X`, `KRWUSD=X`)도
> 그대로 받기 때문에 v2.2 는 기본적으로 `computeBacktest` 한 함수의 옵션 확장 + 두 화면의
> `runBacktest` 가 FX 시리즈도 같이 fetch 하도록 묶어주는 작업이다.

### 결합 수익률 모델

```
종목수익률_local_i = (endClose_i − startClose_i) / startClose_i              # v2.0 (자기 통화)
fx_return_i       = (endFXRate_i − startFXRate_i) / startFXRate_i           # 종목통화 → base 환율 변화
종목수익률_base_i = (1 + 종목수익률_local_i) × (1 + fx_return_i) − 1         # 결합
포트폴리오수익률  = Σ ( 정규화비중_i × 종목수익률_base_i ) × 100  (%)
```

- 종목 currency == base currency 이면 `fx_return = 0` → v2.0 결과와 정확히 일치 (회귀 없음).
- 결합은 곱(`×`)으로 — 환율 변화와 가격 변화의 복리 결합이 환산 수익률의 정의.
- 정규화·제외·재정규화 규칙은 v2.0 과 동일.

### 기준 통화(base) 결정

| 화면 | base |
|---|---|
| 계좌 화면 (`AccountScreen`) | `activeAccount.currency` (계좌가 KRW 이면 KRW) |
| 통합 화면 (`ConsolidatedScreen`) | 헤더의 현재 토글 값(`base` state, `'KRW'` \| `'USD'`) — 이미 존재. 토글 시 백테스트 캐시를 무효화해 재계산. |

### FX 시리즈 조회

기존 `fetchHistoricalClose(symbol, range)` 가 FX 심볼도 그대로 받는다(`USDKRW=X`).
두 화면의 `runBacktest` 에서 종목 fetch 와 함께 **한 번의 `Promise.all` 로 같이 가져온다**:

```js
const weighted = buildAccountWeights(activeAccount); // 또는 buildConsolidatedWeights(holdings)
const symbols  = uniqueSymbolsForBacktest(weighted);
const base     = activeAccount.currency;             // 또는 헤더 토글의 base
const fxPairs  = uniqueFXPairsForBacktest(weighted, priceMap, base);
//                 → priceMap[symbol].currency 가 base 와 다를 때만 `{cur}{base}=X` 추가

const [priceMap0, fxPriceMap] = await Promise.all([
  fetchHistoricalCloses(symbols, '6mo'),
  fetchHistoricalCloses(fxPairs, '6mo'),
]);
const fxMap = buildFXMap(priceMap0, fxPriceMap, base);
const result = computeBacktest(weighted, priceMap0, { baseCurrency: base, fxMap });
```

> ⚠️ 종목 시리즈를 먼저 받아야 각 종목의 currency 를 알 수 있다.
> 그래서 실제 코드에선 **두 단계**가 된다: ① 종목 fetch → ② fxPairs 결정 후 fetch.
> 또는 `priceMap` 의 currency 기반으로 fxPairs 를 빌드해 두 fetch 를 묶거나, 종목 currency 가
> 항목에 캐시되어 있으면 (현재 `item.currency` 가 있음) 한 번에 끝낼 수 있다 — 후자가 권장.

### 신규 함수 (`src/utils/backtest.js` 추가)

| 함수 | 역할 |
|---|---|
| `uniqueFXPairsForBacktest(weighted, base)` | `weighted[i].currency` 가 `base` 와 다른 종목들의 통화를 모아 `{cur}{base}=X` 유니크 배열로 반환. 종목의 currency 가 없으면 무시(이미 priceMap 으로 보정 가능). |
| `buildFXMap(priceMap, fxPriceMap, base)` | `{ [currency]: { startFXRate, endFXRate } }` 형태로 정규화. base==currency 인 경우는 `{ startFXRate: 1, endFXRate: 1 }` 로 주입. |
| `computeBacktest(weighted, priceMap, options?)` | **시그니처 확장**: `options = { baseCurrency, fxMap }` 가 주어지면 결합 수익률 사용, 없으면 v2.0 동작 그대로(회귀 0). |

`buildAccountWeights` / `buildConsolidatedWeights` 에 `currency` 필드를 추가해 흘려보낸다
(이미 데이터에 있음 — `item.currency`, `holdings[].currency` 는 통합에서 추가 필요).

### 화면 변경

- **`src/screens/AccountScreen.js`**: `runBacktest` 에서 `account.currency` 를 base 로 사용,
  FX pair 도 같이 fetch, `computeBacktest` 에 `{ baseCurrency, fxMap }` 전달. 모달 title 에 base 표시.
- **`src/screens/ConsolidatedScreen.js`**: 헤더 `base` toggle 값을 그대로 base 로 사용. 토글 변경 시
  `setBacktestResult(null)` (캐시 무효화) — 이미 holdings 변경 시 무효화하는 useEffect 가 있으니
  의존 배열에 `base` 추가만 하면 됨.
- **`src/components/BacktestModal.js`**: `total` 라벨에 base 통화 표시("(KRW 기준)").
  `excluded` 에 `'no-fx-data'` 사유 라벨 추가.

### 결측·예외 처리

- **FX 시리즈 결측**: 해당 종목 자체를 **제외 + 경고**(`reason: 'no-fx-data'`). 자기 통화 폴백은
  부정확한 결과를 "정답인 양" 보여주는 신호 오류라 채택하지 않는다.
- **종목 currency 누락**: priceMap 의 `series.currency` 를 신뢰 (v8 chart meta 가 보장).
  거기도 없으면 `no-fx-data` 로 처리.

### 테스트 (`src/utils/__tests__/backtest.test.js` 확장)

| 케이스 | 기대 |
|---|---|
| base==currency (KRW 계좌, KRW 종목, fxMap 비어 있음) | v2.0 과 동일 결과 (회귀 0 확인) |
| KRW 계좌 + USD 종목 (`fx_return = -5%`, `stock = +10%`) | `(1.10 × 0.95) − 1 = 4.5%` 일치 |
| 한 종목만 FX 결측 | 해당 종목만 `excluded({reason:'no-fx-data'})`, 나머지로 재정규화 |
| 옵션 없이 호출 (`computeBacktest(weighted, priceMap)`) | v2.0 동작 그대로 |

### MVP 한계 (문서화)

- 6개월·일별 종가 기준. FX 종가는 동일 영업일 매칭(주말/휴장 차이는 첫·끝 유효 종가 정책으로 흡수).
- 배당·거래비용 미반영(v2 한계 그대로 승계).
- 거래소 통화가 v8 meta 와 불일치하는 ETF(예: 호스팅 통화와 거래 통화가 다른 케이스)는 향후 보강.

---

## v3 — 공유 대시보드 + 순위판

> v2의 백테스트 위에서 동작한다. **이 시점부터 서버(Supabase) 전송이 시작**되므로
> 개인정보 처리방침·데이터 수집 설문 갱신이 선결 과제다.

### 공통 선결 작업 (v3 진입 전 1회)

- **Supabase 프로젝트 생성** (Postgres + Auth, MVP는 RLS만).
- 의존성 추가: `@supabase/supabase-js`, `react-native-url-polyfill` (RN fetch/URL 폴리필).
- **환경변수**: `app.json`의 `expo.extra`에 `supabaseUrl` / `supabaseAnonKey`.
  anon 키는 공개 가능(RLS로 보호)하나, EAS 빌드에서 주입되도록 `eas.json` env로 관리.
- **개인정보 처리방침 / App Store 데이터 수집 설문 갱신** — 서버 전송이 시작되므로 필수.
  수집 항목: 닉네임, 공유 포트폴리오(종목+비중), 익명 user id, 백테스트 수익률.

### 데이터 모델 (Supabase)

```sql
-- profiles: 익명 유저의 닉네임
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null,
  created_at timestamptz default now()
);

-- shared_portfolios: 공유된 포트폴리오 (비중만, 금액 없음) + 순위판 수익률
create table shared_portfolios (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users on delete cascade,
  title text not null,
  visibility text not null default 'public',   -- 'public' | 'unlisted' | 'private'
  base_currency text not null default 'KRW',
  holdings jsonb not null,   -- [{ name, symbol, category, targetPercent }]
  return_6m numeric,                  -- v2가 계산한 6개월 백테스트 수익률(%) (클라이언트 제출)
  return_computed_at timestamptz,
  on_leaderboard boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

- **RLS 정책**: 본인(`owner = auth.uid()`)만 INSERT/UPDATE/DELETE. SELECT는
  `visibility = 'public'` 이거나 본인 것. `unlisted`는 id를 아는 경우만(링크 공유).
- `holdings`는 **비중·종목 메타만** — `totalAmount`/`ownedShares`/`currentPrice` 제외.
- 순위판 = `shared_portfolios where on_leaderboard and visibility='public' order by return_6m desc`.

### 신규 코드

| 파일 | 역할 |
|---|---|
| `src/services/supabase.js` | Supabase 클라이언트 싱글톤 (`createClient` + `extra` 키 로딩), 익명 로그인 보장 헬퍼 |
| `src/services/shareApi.js` | `publishPortfolio()`, `updateShared()`, `unpublish()`, `listPublic()`, `getShared(id)`, `submitToLeaderboard()`, `listLeaderboard()` |
| `src/utils/shareSerialize.js` | 로컬 계좌 → 공유 페이로드 변환 (**비중만 추출**). `buildConsolidatedExport`(`src/utils/exportData.js`) 형식 정신 재사용 |
| `src/context/AuthContext.js` | 익명 세션 + 닉네임 상태. `App.js`에서 트리 래핑 |
| `src/screens/ShareDashboardScreen.js` | 공개 포트폴리오 목록 탐색 |
| `src/screens/SharedDetailScreen.js` | 단일 공유 포트폴리오 **읽기 전용 뷰어** |
| `src/screens/LeaderboardScreen.js` | 수익률 내림차순 순위판 (닉네임 + 수익률 + 종목 미리보기) |
| `src/components/NicknameModal.js` | 최초 공유 시 닉네임 입력 |

### 재사용 (수정 최소화)

- `src/utils/aggregate.js`의 `aggregateAcrossAccounts` / `aggregateByCategory` — 공유 뷰어 비중 분포.
- `src/components/DonutChart.js` — 읽기 전용 뷰어 차트.
- `src/screens/ConsolidatedScreen.js` — 렌더 로직을 **읽기 전용 공용 컴포넌트로 추출**해
  본인 통합 뷰와 `SharedDetailScreen`이 공유 (선택: 처음엔 복제 후 통합).
- `src/components/ExportButtons.js` — 옆에 "공유하기(게시)" 버튼 추가 패턴 참고.
- `src/utils/backtest.js` (v2) — "포트폴리오 자랑하기" 시 `return_6m` 계산 재사용.

### 네비게이션 변경

- `src/navigation/AppNavigator.js`: 하단 탭에 **"공유"** 탭 추가. 공유 탭 내부는
  `createNativeStackNavigator`로 목록(`ShareDashboardScreen`) → 상세(`SharedDetailScreen`) →
  순위판(`LeaderboardScreen`) 스택 구성 (탭 과밀하면 공유 탭 상단 세그먼트).
- `App.js`: `AuthProvider`로 트리 래핑.

### 화면 흐름

1. 계좌/통합 화면에서 **"공유하기"** → (최초 1회) 닉네임 입력 → 익명 로그인 →
   비중만 추출해 `shared_portfolios`에 INSERT → 성공 토스트.
2. **공유 탭** → 공개 목록 → 항목 탭 → 읽기 전용 뷰어(도넛 + 종목 리스트, 닉네임 표시).
3. **"포트폴리오 자랑하기"** → v2 백테스트로 `return_6m` 계산 →
   `return_6m`/`return_computed_at`/`on_leaderboard=true` UPDATE → 순위판 노출.

### MVP의 알려진 한계 (문서화)

- 클라이언트 제출 수익률은 **조작 가능** → 향후 Supabase Edge Function 서버 재계산으로 교체.
- 환차익 미반영, 배당 미반영, 6개월 고정 기간(v2 모델 한계 그대로 승계).

---

## 검증 방법

**v2.0 (보유 수익률)**
- `npm test` — `backtest.js`: 정상 수익률, 결측 종목 재정규화, 0종목(null), 음수 수익률 등 엣지 케이스.
  `stockApi.test.js` 확장: `timestamp`+`indicators.quote[0].close`(중간 null 포함) stub으로
  `startClose`/`endClose` 파싱·`range=6mo` URL·부분 실패 검증.
- `npm run test:live:backtest` — `fetchHistoricalClose('005930.KS','6mo')` 실호출로 시작/끝 종가 검증.
  (코드 작성 전 `adjclose`/`close` 배열 형태·null 분포를 이 스크립트로 1회 확인 권장)
- 시뮬레이터(`npx expo start`): 계좌/통합 화면 "6개월 백테스트" → 총 수익률 + 종목별 내역,
  심볼 없는 항목이 "제외"로 표시되고 재정규화되는지, 음수=빨강/양수=초록 확인.

**v2.1 (N일 리밸런싱)**
- `npm test` — `simulate`: N=∞가 v2.0 보유와 일치, 반대로 움직이는 두 종목에서 리밸런싱>보유,
  단일 종목이면 보유=리밸런싱, `alignSeries` 공통축/forward-fill 정렬.
- 시뮬레이터: 모달 세그먼트(보유·매주·매월·매분기) 전환 시 수익률과 "보유 대비 ±%p"가 바뀌는지 확인.

**v2.2 (환차익 포함)**
- `npm test` — `computeBacktest` 옵션 없이 호출 = v2.0 결과 그대로(회귀 0 확인),
  KRW 계좌 + USD 종목 결합식((1.10×0.95)−1=4.5%) 일치, FX 결측 한 종목만 `no-fx-data` 로 분리·재정규화.
- `npm run test:live:backtest` — `USDKRW=X` 가 실 응답으로 잡히는지(기존 라이브 스크립트에 케이스 추가 권장).
- 시뮬레이터: 통합 화면 헤더의 KRW/USD 토글을 바꾸면 백테스트 캐시가 무효화되고 결과가 바뀌는지,
  모달 라벨에 "(KRW 기준)" / "(USD 기준)" 이 표시되는지 확인.

**v3 (공유 + 순위판)**
- `npm test` — `shareSerialize`가 금액/보유수량을 절대 포함하지 않음을 단위 테스트로 검증.
- `npx expo start` 실기기: 공유하기 → Supabase 대시보드에서 row 확인 → 다른 기기에서 공유 탭 노출 확인.
- Supabase SQL 에디터로 RLS 검증: 타인 row UPDATE 시도가 거부되는지 확인.
- 자랑하기 → 순위판에 닉네임·수익률 내림차순 표시 확인.

---

## 구현 순서 (권장)

**v2.0 (먼저, 서버 불필요) — 보유 수익률**
1. `stockApi.js`: `parseChartSeries` + `fetchHistoricalClose` + `fetchHistoricalCloses` (+ 테스트 확장).
2. `backtest.js`(`computeBacktest`) + `backtest.test.js`.
3. `BacktestModal.js`.
4. 계좌·통합 화면에 버튼+모달 연결.
5. `scripts/check-historical-close.js` + `package.json` `test:live:backtest`.

**v2.1 (v2.0 완료·안정화 후) — N일 리밸런싱**
6. `parseChartSeries`를 전체 시리즈 반환으로 확장(`startClose`/`endClose`는 파생 유지).
7. `backtest.js`에 `alignSeries` + `simulate(weighted, seriesMap, {intervalDays})` 추가 (+ 테스트).
8. `BacktestModal`에 보유/매주/매월/매분기 세그먼트 + "보유 대비 ±%p" 표시.

**v2.2 (v2.1 완료 후) — 환차익 포함**
9. `backtest.js`에 `uniqueFXPairsForBacktest` + `buildFXMap` + `computeBacktest` 옵션
   (`baseCurrency`, `fxMap`) 확장 (+ 테스트 — 회귀 0, USD/KRW 결합 케이스, no-fx-data 제외).
10. `AccountScreen.runBacktest` — base=`account.currency`, FX pair 같이 fetch, 옵션 전달.
11. `ConsolidatedScreen.runBacktest` — base=헤더 토글값, base 변경 시 캐시 무효화 추가.
12. `BacktestModal` 라벨에 base 통화 표시, `no-fx-data` reason 라벨 추가.

**v3 (이후, Supabase 도입)**
13. 공통 선결: Supabase 프로젝트 + 의존성 + `supabase.js` + 익명 로그인 + 개인정보 설문 갱신.
14. `shareSerialize`(테스트) → `shareApi` → `AuthContext`/닉네임 → 공유 탭/뷰어.
15. 순위판: `submitToLeaderboard`/`listLeaderboard` → 자랑하기 버튼(v2 `backtest.js` 재사용) → `LeaderboardScreen`.
16. `roadmap.md`의 v2/v3 항목을 "구현 중/완료"로 갱신.
