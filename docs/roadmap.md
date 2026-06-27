# Roadmap

> 마지막 업데이트: 2026-06-27
> 현재 앱 버전: **1.2.0** (`app.json` 기준)
> 관련 문서: [`../README.md`](../README.md) · [`../progress.md`](../progress.md) · [`../CHANGELOG.md`](../CHANGELOG.md)

이 문서는 App Store에 배포하는 **marketing version**을 기준으로 기능 범위를 기록합니다.
각 섹션은 실제 iOS 배포 버전과 해당 버전에 포함된 기능만 기록합니다.

---

## 1.0.0 — 로컬 전용 (출시 완료)

- 계좌별 포트폴리오 구성 / 목표 비중 / 리밸런싱 권장 매수
- 전 계좌 통합 뷰 (종목별 / 카테고리별)
- Yahoo Finance 시세·검색·환율 연동
- AsyncStorage 로컬 저장, JSON 내보내기
- 데이터는 전부 기기 내부에만 저장 (서버 전송 없음)

---

## 1.1.0 — 6개월 백테스트 (출시 완료)

### 포함 기능

| # | 기능 | 메모 |
|---|---|---|
| 1 | 과거 시세 조회 | Yahoo `chart`의 `range=6mo&interval=1d` 응답에서 일별 종가 확보 |
| 2 | 6개월 보유 백테스트 | 현재 포트폴리오 구성을 6개월 전에 그대로 들고 있었다면의 비중 가중 수익률 |
| 3 | N영업일 리밸런싱 백테스트 | 보유 / 매주 / 매월 / 매분기 모드 비교 |
| 4 | 계좌 + 통합 지원 | 계좌 화면과 통합 화면 모두 지원 |
| 5 | 결측·제외 처리 | 심볼 없음, 상장 6개월 미만, 조회 실패 종목 제외 후 비중 재정규화 |

### 수익률 계산 모델

```text
종목 수익률       = (현재종가 - 6개월전 종가) / 6개월전 종가
정규화 비중       = 종목비중 / 제외 안 된 종목들의 비중 합
포트폴리오 수익률 = Σ(정규화비중_i × 종목수익률_i) × 100
```

- 계산 위치: 클라이언트
- 기준: 종목 자기 통화 기준
- 기간: 6개월 고정
- 배당, 거래비용, 세금은 미반영

### 구현 메모

- 주요 코드:
  - `src/services/stockApi.js`: `fetchHistoricalClose`, `fetchHistoricalCloses`
  - `src/utils/backtest.js`: 비중 빌드, 시계열 정렬, 보유/리밸런싱 시뮬레이션
  - `src/components/BacktestModal.js`: 보유/매주/매월/매분기 결과 표시
  - `src/screens/AccountScreen.js`, `src/screens/ConsolidatedScreen.js`: 백테스트 실행 연결
- 검증:
  - `src/utils/__tests__/backtest.test.js`
  - `src/services/__tests__/stockApi.test.js`
  - `npm run test:live:backtest`

---

## 1.2.0 — 공유 + 둘러보기 + 순위 (구현 완료, 배포 준비)

### 포함 기능

| # | 기능 | 메모 |
|---|---|---|
| 1 | Supabase 연동 | `@supabase/supabase-js`, RLS, RPC |
| 2 | 별명+비밀번호 인증 | Supabase Auth 미사용, 앱 테이블에 bcrypt 해시 저장 |
| 3 | 포트폴리오 공유 | 비중(%)만 서버 전송, 금액·보유수량·현재가는 전송하지 않음 |
| 4 | 공유 코드 뷰어 | `share_token`으로 읽기 전용 조회 |
| 5 | 둘러보기 탭 | 공개 포트폴리오 Top5, 별명 검색, 종목 검색, 더보기 |
| 6 | 순위 등재 | 6개월 백테스트 수익률 기준 정렬 |
| 7 | 내 공유물 관리 | 제목/공개범위 수정, 삭제 |
| 8 | UGC 대응 | EULA, 신고, 자동 숨김, 로컬 차단, 비속어 필터 |

### 확정된 결정

- 공유 범위: 종목명, 심볼, 카테고리, 목표 비중만 전송
- 읽기: 로그인 불필요
- 쓰기/관리: 별명+비밀번호를 RPC에 전달해 소유권 검증
- 순위 수익률: 현재 앱에서 6개월 백테스트를 계산해 `submit_return` RPC로 제출

### 구현 메모

- 주요 코드:
  - `src/services/supabase.js`: Supabase anon 클라이언트, Supabase Auth 세션 미사용
  - `src/services/shareApi.js`: `publishPortfolio`, `getSharedByToken`, `browsePublic`, `submitReturn`, `listMine`, `updateShared`, `unpublishPortfolio`, `reportShared`
  - `src/context/AuthContext.js`: 별명+비밀번호 등록/검증
  - `src/utils/shareSerialize.js`: 비중만 추출, 금액/수량/현재가 제외
  - `src/utils/moderation.js`, `src/utils/localModeration.js`: 금칙어, 로컬 신고/차단 상태
  - `src/components/ShareModal.js`, `src/components/ViewSharedModal.js`, `src/components/SharedViewer.js`, `src/components/MySharesModal.js`, `src/components/SharedDetailModal.js`
  - `src/screens/BrowseScreen.js`
  - `src/navigation/AppNavigator.js`: `둘러보기` 탭
- Supabase 구성:
  - `app_users`: 별명, bcrypt 비밀번호 해시
  - `shared_portfolios`: 공유 포트폴리오, 공개범위, 공유 토큰, 수익률, 숨김 상태
  - `reports`: 익명 신고 및 누적 자동 숨김
  - 주요 RPC: `auth_nickname`, `publish_portfolio`, `update_portfolio`, `unpublish_portfolio`, `get_shared_by_token`, `report_shared`, `browse_public`, `submit_return`, `list_mine`
- 검증:
  - `src/utils/__tests__/shareSerialize.test.js`
  - `src/services/__tests__/shareApi.test.js`
  - `src/utils/__tests__/nickname.test.js`
  - `src/utils/__tests__/moderation.test.js`
  - `scripts/check-supabase.js`

## 배포 전 남은 운영 작업

- App Store Connect App Privacy 설문을 1.2.0 기준으로 갱신
- GitHub Pages의 `privacy-policy.md`가 공유 전송 데이터 포함 버전으로 게시되어 있는지 확인
- EAS production 빌드 및 제출
- TestFlight/실기기에서 공유, 코드 열람, 둘러보기, 신고/차단, 내 공유물 관리를 확인
- RPC 레이트리밋은 보안 강화 과제로 별도 추적
