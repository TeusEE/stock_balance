# v3 상세 구현 계획 — 공유 대시보드 + 순위판 (Supabase)

> 상태: **설계 / 구현 대기**
> 작성: 2026-06-09 · 상위 문서: [`v2-v3-implementation-plan.md`](v2-v3-implementation-plan.md) (v3 섹션) · [`roadmap.md`](roadmap.md)
> 이 문서는 상위 문서의 v3 섹션을 **검토·확장**한 실행용 상세 계획이다.

---

## 0. 기존 계획 검토 (무엇이 충분하고, 무엇이 빠졌나)

**충분한 부분 (상위 문서가 이미 잘 잡음)**
- 아키텍처: `profiles` / `shared_portfolios` 2테이블, 비중만 공유, 익명 로그인+닉네임.
- 신규 파일·재사용 목록, 네비게이션(공유 탭), 화면 흐름, 구현 순서.
- 핵심 프라이버시 원칙: 금액/보유수량/현재가는 **서버로 안 보냄**.

**빠져 있어 이 문서에서 보강하는 갭 (중요도 순)**
1. **App Store UGC 심사(Guideline 1.2)** — 닉네임·공유 포트폴리오·순위판은 **사용자 생성 콘텐츠(UGC)**. Apple은 UGC 앱에 **신고/차단/모더레이션/EULA**를 요구한다. 기존 계획에 전혀 없음. → §7
2. **App Privacy 설문 전환** — v1·v2는 "Data Not Collected"였으나 v3는 **수집 시작**. 어떤 카테고리를 어떻게 신고할지 명시 필요. → §7
3. **RN에서 Supabase 세션/스토리지 설정** — `AsyncStorage` 어댑터, `react-native-url-polyfill/auto`, `detectSessionInUrl:false`, AppState 토큰 갱신. 누락 시 세션 유지·익명 로그인이 깨짐. → §3
4. **정확한 RLS 정책문(SQL)** — 상위 문서는 "정책은 추후 작성"으로 비어 있음. → §4
5. **익명 계정 데이터 소실 주의** — 앱 삭제/재설치 시 익명 user id가 사라져 공유물 접근 불가. UX·문서 처리 필요. → §3
6. **'unlisted'(링크 공유)의 RLS 한계** — blanket SELECT 로는 비밀 보장이 안 됨. MVP 범위 조정. → §4
7. **키 관리 구체화**(app.json extra vs EAS env)와 **출시 버전 분리**(1.1.0 심사와 격리). → §2, §9

---

## 1. 범위 (MVP)

**포함**: 익명 로그인+닉네임 / 포트폴리오 공개(비중만) / 공개 목록 탐색 / 읽기전용 뷰어 /
순위판(6개월 수익률 내림차순) / "자랑하기" 제출 / **신고·차단·EULA(1.2 대응)**.

**제외(차기)**: 소셜 로그인, 'unlisted' 링크 공유, 서버 측 수익률 재계산(Edge Function),
팔로우/댓글, 환차익 반영(취소됨).

**범위 조정**: `visibility` 는 MVP 에서 **`public` / `private` 두 값만**. `unlisted` 는 안전한
링크 공유(`share_token` + RPC)가 필요하므로 차기로 미룬다(§4 참고).

---

## 2. 선결 작업 (구현 진입 전 1회)

### Supabase (계정 보유자 직접)
- [ ] 프로젝트 생성 → **Project URL**, **anon public key** 확보 (Settings → API)
- [ ] Authentication → Providers → **Anonymous sign-in 활성화**
- [ ] SQL Editor에 §4 스키마 + RLS 실행
- [ ] (선택) Auth → Rate limits 확인 (익명 가입 남용 방지)

### 클라이언트 의존성
- [ ] `@supabase/supabase-js`, `react-native-url-polyfill`, `@react-native-async-storage/async-storage`(이미 있음)

### 키 관리
- anon 키는 공개돼도 **RLS로 보호**되므로 `app.json`의 `expo.extra.supabaseUrl/supabaseAnonKey`에 둔다.
- 빌드 환경 분리를 위해 `eas.json`의 `build.production.env`로도 주입 가능. `expo-constants`의
  `Constants.expoConfig.extra`로 런타임 로드.
- service_role 키는 **절대 클라이언트에 넣지 않는다.**

### 출시 분리 ⚠️
- v3는 **서버 전송이 시작**되므로 현재 심사 중인 **1.1.0에 포함하지 않는다.**
- v3는 별도 버전(예: **1.2.0**)으로, 1.1.0 통과 후 진행. 처리방침·App Privacy 갱신과 함께 제출.

---

## 3. 인증 (익명 + 닉네임)

### Supabase 클라이언트 (`src/services/supabase.js`)
RN 전용 설정이 핵심 — 빠지면 세션이 유지되지 않는다.
```js
import 'react-native-url-polyfill/auto';            // 최상단, fetch/URL 폴리필
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const { supabaseUrl, supabaseAnonKey } = Constants.expoConfig.extra;
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,   // RN 필수
  },
});
```
- AppState 변화 시 `supabase.auth.startAutoRefresh()/stopAutoRefresh()` 연결(포그라운드 토큰 갱신).
- `ensureSession()`: 세션 없으면 `signInAnonymously()` 호출 후 `profiles` 행 보장(닉네임).

### AuthContext (`src/context/AuthContext.js`)
- 앱 시작 시 세션 복원 → 없으면 lazy 익명 로그인은 **공유 시점**까지 미룬다(불필요한 익명 계정 양산 방지).
- 상태: `{ session, nickname, ensureSignedIn(), setNickname() }`. `App.js`에서 트리 래핑.

### ⚠️ 익명 계정 데이터 소실 (문서화·UX)
- 익명 user id는 기기/세션 로컬. **앱 삭제·재설치 시 복구 불가** → 공유물 소유권 상실.
- MVP: 닉네임 입력 모달에 "이 기기에서만 관리됩니다" 안내. 차기: 이메일 연동(`linkIdentity`)으로 복구 제공.

---

## 4. 데이터 모델 + RLS (정확한 SQL)

```sql
-- profiles: 익명 유저 닉네임 (닉네임은 순위판/뷰어에 노출되는 공개 표시명)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  created_at timestamptz default now()
);

create table shared_portfolios (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  visibility text not null default 'public' check (visibility in ('public','private')),
  base_currency text not null default 'KRW',
  holdings jsonb not null,            -- [{name, symbol, category, targetPercent}] — 금액/수량/현재가 없음
  return_6m numeric,
  return_computed_at timestamptz,
  on_leaderboard boolean not null default false,
  is_hidden boolean not null default false,   -- 신고 누적/모더레이션 시 숨김
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on shared_portfolios (visibility, on_leaderboard, return_6m desc);

-- 신고 (UGC 1.2 대응)
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users on delete cascade,
  portfolio_id uuid not null references shared_portfolios on delete cascade,
  reason text,
  created_at timestamptz default now(),
  unique (reporter, portfolio_id)             -- 1인 1신고
);

-- 차단 (UGC 1.2 대응): 내가 차단한 소유자
create table blocks (
  blocker uuid not null references auth.users on delete cascade,
  blocked uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker, blocked)
);

alter table profiles          enable row level security;
alter table shared_portfolios enable row level security;
alter table reports           enable row level security;
alter table blocks            enable row level security;

-- profiles: 닉네임은 공개 읽기, 본인만 생성/수정
create policy profiles_read   on profiles for select using (true);
create policy profiles_insert on profiles for insert with check (id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid());

-- shared_portfolios
create policy sp_read on shared_portfolios for select
  using ((visibility = 'public' and not is_hidden) or owner = auth.uid());
create policy sp_insert on shared_portfolios for insert with check (owner = auth.uid());
create policy sp_update on shared_portfolios for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy sp_delete on shared_portfolios for delete using (owner = auth.uid());

-- reports / blocks: 본인 것만
create policy reports_insert on reports for insert with check (reporter = auth.uid());
create policy blocks_all on blocks for all using (blocker = auth.uid()) with check (blocker = auth.uid());
```

**설계 메모**
- `holdings` 는 **비중·종목 메타만**. 직렬화 단계(§5)에서 금액/수량/현재가 제거를 강제.
- `is_hidden` + `reports` + `blocks` 로 1.2(UGC) 요구를 충족. 신고 임계치 누적 시 `is_hidden=true`
  (MVP: 수동/간단 트리거. 차기: Edge Function 자동화).
- **'unlisted' 미지원 이유**: blanket SELECT 정책으로는 uuid를 아는 사람만 보게 보장하기 어렵고
  공개 목록 쿼리와 분리도 애매하다. 차기 `share_token uuid` + `security definer` RPC 로 구현.
- 순위판 쿼리: `select ... join profiles ... where visibility='public' and on_leaderboard and not is_hidden order by return_6m desc limit N`.
  (차단 필터는 클라이언트에서 `blocks` 와 대조하거나 RPC에서 처리.)

---

## 5. 직렬화 — 비중만 추출 (`src/utils/shareSerialize.js`)

```js
// 로컬 계좌/통합 → 공유 페이로드. 금액/보유수량/현재가는 절대 포함하지 않는다.
export function toSharePayload({ title, baseCurrency, holdings }) {
  return {
    title,
    base_currency: baseCurrency,
    holdings: holdings.map((h) => ({
      name: h.name,
      symbol: h.symbol ?? null,
      category: h.category ?? null,
      targetPercent: Number(h.targetPercent) || 0,
    })),
  };
}
```
- 입력은 `aggregateAcrossAccounts`/`aggregateByCategory`(`src/utils/aggregate.js`) 결과 또는 단일 계좌.
- **단위 테스트(필수)**: 출력 객체에 `totalAmount`/`ownedShares`/`currentPrice` 키가 **절대 없음**을 단언.

---

## 6. 신규 코드 / 재사용 / 네비게이션

### 신규 파일
| 파일 | 역할 |
|---|---|
| `src/services/supabase.js` | 클라이언트 싱글톤(§3), `ensureSession()` |
| `src/services/shareApi.js` | `publishPortfolio` / `updateShared` / `unpublish` / `listPublic` / `getShared` / `submitToLeaderboard` / `listLeaderboard` / `report` / `block` |
| `src/utils/shareSerialize.js` | 비중만 추출(§5) |
| `src/context/AuthContext.js` | 익명 세션 + 닉네임 |
| `src/screens/ShareDashboardScreen.js` | 공개 목록 탐색 |
| `src/screens/SharedDetailScreen.js` | 읽기전용 뷰어 + **신고/차단** 버튼 |
| `src/screens/LeaderboardScreen.js` | 수익률 내림차순 순위판 |
| `src/components/NicknameModal.js` | 최초 공유 시 닉네임 입력 + EULA 동의 |

### 재사용
- `src/utils/aggregate.js`(`aggregateAcrossAccounts`/`aggregateByCategory`) — 뷰어 비중 분포.
- `src/components/DonutChart.js` — 뷰어 차트.
- `src/screens/ConsolidatedScreen.js` — 렌더 로직을 **읽기전용 공용 컴포넌트로 추출**해 뷰어와 공유.
- `src/utils/backtest.js` — "자랑하기" `return_6m` 계산 재사용.
- `src/components/ExportButtons.js` — "공유하기" 버튼 추가 위치 참고.

### 네비게이션
- `src/navigation/AppNavigator.js`: 하단 탭에 **"공유"** 추가 → 내부 stack:
  `ShareDashboard → SharedDetail → Leaderboard`.
- `App.js`: `AuthProvider` 래핑.

---

## 7. App Store 컴플라이언스 (필수 — 기존 계획 누락분)

### 7-1. UGC — Guideline 1.2 (반드시 충족)
닉네임·공유 포트폴리오·순위판은 사용자 생성 콘텐츠다. Apple 요구사항:
- [ ] **EULA 동의** — 최초 공유 전 "불쾌한 콘텐츠 무관용" 약관 동의(NicknameModal 내 체크).
- [ ] **신고(report)** — 모든 공유 항목/순위판 항목에 "신고" 버튼(`reports` INSERT).
- [ ] **차단(block)** — 특정 사용자 콘텐츠 숨기기(`blocks`).
- [ ] **모더레이션** — 신고된 콘텐츠 24시간 내 조치(MVP: `is_hidden` 수동/임계치). 운영 연락처(이미 `xodn1311@gmail.com`).
- [ ] **콘텐츠 필터** — 닉네임/제목 비속어 1차 필터(간단 금지어 목록).

### 7-2. App Privacy 설문 (Data Not Collected → 수집 신고)
v3부터 다음을 수집한다고 신고:
- **Identifiers → User ID**: 익명 user id (Linked, 추적 아님).
- **User Content → Other User Content**: 닉네임, 공유 포트폴리오(종목+비중), 제목.
- 용도: App Functionality. **추적(Tracking) 아님.** 광고/분석 SDK 없음 유지.

### 7-3. 처리방침 / 심사 Notes 갱신
- `docs/privacy-policy.md`: "서버로 전송되는 데이터" 섹션 추가 — 닉네임·공유 비중·익명 id·수익률,
  전송 대상 Supabase, 사용자가 삭제(unpublish) 가능, 금액/수량/현재가는 **전송 안 함** 명시.
- `docs/app-review-notes.md`: 외부 서비스에 **Supabase** 추가(인증=익명, RLS 보호), UGC 신고/차단 흐름 설명.
- 호스트 추가: `*.supabase.co`.

---

## 8. 보안 / 무결성
- **RLS 검증**: SQL 에디터에서 타 user 의 row UPDATE/DELETE/INSERT(owner 위조) 거부 확인.
- **수익률 조작 가능성**: `return_6m` 은 클라이언트 제출 → **조작 가능**. MVP 한계로 문서화하고,
  차기 **Edge Function 서버 재계산**으로 대체(순위판 신뢰성).
- **익명 가입 남용**: 공유 시점까지 익명 로그인 지연 + Supabase rate limit.
- service_role 키 클라이언트 유입 금지(코드리뷰 체크).

---

## 9. 테스트 / 검증
- `npm test`: `shareSerialize` 가 금액/수량/현재가를 **절대 포함하지 않음** 단위 테스트(핵심).
- `shareApi` 는 supabase 클라이언트 mock 으로 페이로드 형태/필수 필드 검증.
- 실기기(`npx expo start`): 공유 → Supabase 대시보드 row 확인 → 다른 기기 공유 탭 노출.
- RLS: 타인 row 변조 거부, `is_hidden`/`private` 가 목록에서 빠지는지.
- 자랑하기 → 순위판 닉네임+수익률 내림차순. 신고/차단 동작.

## 10. 구현 순서 (권장)
1. **기반**: deps 추가, `supabase.js`(§3), `AuthContext`, `app.json extra`. 익명 로그인+`profiles` 생성까지.
2. **직렬화+게시**: `shareSerialize`(+테스트), `shareApi.publish/update/unpublish`, "공유하기" 버튼+`NicknameModal`(EULA).
3. **탐색+뷰어**: `ShareDashboardScreen`, 읽기전용 뷰어(`ConsolidatedScreen` 렌더 추출), `getShared`.
4. **순위판+자랑하기**: `submitToLeaderboard`(backtest 재사용), `LeaderboardScreen`.
5. **UGC 컴플라이언스**: 신고/차단/`is_hidden`/EULA/비속어 필터(§7-1).
6. **심사 문서**: 처리방침·App Privacy·Notes 갱신(§7-2,3).
7. **출시**: 버전 1.2.0, 1.1.0 통과 후 빌드·제출.

## 11. 리스크 / 한계 (문서화)
- 익명 계정 데이터 소실(재설치). 차기 이메일 연동.
- 클라이언트 제출 수익률 조작 가능. 차기 서버 재계산.
- 환차익·배당 미반영(6개월 고정) — v2 모델 승계.
- 'unlisted' 링크 공유 미지원(차기 `share_token`+RPC).
