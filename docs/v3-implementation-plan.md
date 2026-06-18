# v3 상세 구현 계획 (리비전) — 공유 대시보드 + 순위판 (Supabase)

> 상태: **v3.0 구현 거의 완료** — 데이터 레이어·공유/뷰어 UI·UGC(익명 신고/자동 숨김/비속어 필터/로컬 차단) 완료. 남은 것: 심사 문서 갱신·레이트리밋·실기기 테스트.
> 작성: 2026-06-09 · **리비전: 2026-06-18** · **진행 갱신: 2026-06-18**
> 상위 문서: [`roadmap.md`](roadmap.md) · 출시 현황: [`../progress.md`](../progress.md)
> 선행 조건: **1.1.0 App Store 배포 완료**(v2.0/v2.1 백테스트 포함). v3는 별도 버전으로 진행.
>
> **v3.0 진행 현황 요약**
> - ✅ Supabase 프로젝트 + §4 스키마/RLS/RPC 적용(`pgcrypto` search_path 패치 + `report_shared` 마이그레이션), 라이브 스모크 통과
> - ✅ 데이터 레이어: `supabase.js` / `shareApi.js` / `AuthContext`(별명+비번) / `shareSerialize` / `nickname` (+테스트)
> - ✅ UI: `ShareModal` / `SharedViewer` / `ViewSharedModal` + 통합 화면 연결, `App.js` AuthProvider
> - ✅ UGC 1.2: 익명 신고(`report_shared`)+신고 3건 자동 숨김 · 비속어 필터(`moderation`) · 기기 로컬 차단(`localModeration`) · EULA. (전체 68개 테스트 통과)
> - ⬜ 처리방침/App Privacy/심사 Notes 갱신 · RPC 레이트리밋 · 실기기 테스트

이 문서는 기존 v3 계획을 **방향은 유지(공유 + 순위판)하되 약점을 보완**해 다시 쓴 실행용 계획이다.
이전 버전(`v2-v3-implementation-plan.md`의 v3 섹션)은 폐기되었다.

---

## 0. 무엇을 리비전했나 (이전 계획 대비 변경점)

이전 v3 계획은 RLS·UGC·App Privacy까지 잡았지만, 출시·운영을 막을 **3가지 구조적 약점**이 있었다.
이번 리비전은 그 3가지를 정면으로 고친다.

| # | 이전 계획의 문제 | 리비전 방향 |
|---|---|---|
| 1 | **익명 로그인 전용** → 앱 삭제/재설치 시 user id 소실 → 공유물·순위 영구 상실. "내 순위/내 공유"가 핵심인 기능에 치명적. | **Supabase Auth 미사용 — 별명+비밀번호를 우리 테이블(`app_users`)에 직접 저장**(bcrypt 해시). 읽기는 로그인 불필요, 쓰기는 RPC가 별명+비번 검증. 같은 별명+비번으로 어느 기기서나 소유권 증명 → 영속. **메일·OTP·GoTrue 없음.** (§3,§4) |
| 2 | **첫 서버 전송 릴리스에 공개 피드 + 순위판 + UGC를 한 번에** 올림 → App Store 1.2(UGC) 심사 리스크가 가장 큰 기능을 처음부터 전부 노출. | **2단계 출시로 분리.** v3.0 = 공유(링크/비공개) + 읽기전용 뷰어, v3.1 = 공개 피드 + 순위판. 첫 서버 릴리스의 심사 표면을 줄인다. (§1) |
| 3 | **순위판 수익률을 클라이언트가 제출** → 누구나 `return_6m`을 위조해 1위 가능. "조작 방지는 향후 과제"로 미룸 → 순위판이 무의미해질 위험. | **✅ 확정: 순위판 수익률은 오직 서버(Edge Function)에서만 계산·기록.** 클라이언트 제출 경로 없음 — `holdings`만 보내고 서버가 Yahoo 시세로 재계산. (§6, §8) |

**유지한 좋은 결정 (그대로 계승)**
- 공유는 **비중(%)만** — 금액·보유수량·현재가는 서버로 보내지 않음.
- RLS로 "본인 것만 쓰기, 공개분만 읽기" 강제.
- RN 전용 Supabase 세션 설정(AsyncStorage 어댑터, `react-native-url-polyfill`, `detectSessionInUrl:false`).
- UGC 1.2 대응(신고/차단/모더레이션/EULA)·App Privacy 설문 전환.

---

## 1. 범위 & 2단계 출시

### v3.0 — 공유 + 읽기전용 뷰어 (첫 서버 전송 릴리스, 예: 1.2.0)
**포함**: 별명+비밀번호 인증(Auth 미사용) / 포트폴리오 공유(비중만, `private`·`unlisted`(링크) ) /
링크(공유 코드)로 받은 공유물 **읽기전용 뷰어** / 신고·차단·EULA(1.2 기본 대응) / 처리방침·App Privacy 갱신.
**핵심**: 공개 "탐색 피드"와 순위판은 **아직 없음** → 무한 노출되는 UGC 표면이 작아 첫 심사 리스크 최소화.

### v3.1 — "둘러보기" 탭 (공개 피드 + 순위 + 검색) (예: 1.3.0)
**포함**: 공개(`public`) 가시성 + "자랑하기"(공개 등재 시 **서버가 6개월 수익률 계산**) /
다른 사람의 포트폴리오를 구경하는 **"둘러보기" 탭 1개**, 다음 4가지 기능:
- ① **상위 5개 순위** — 공개 포트폴리오를 6개월 수익률 내림차순 Top 5
- ② **작성자 별명 검색**
- ③ **특정 종목 포함 포트폴리오 검색**(종목명 또는 티커)
- ④ **더보기** — 10개씩 추가 로드(페이지네이션)

읽기전용 뷰어(`SharedViewer`) 재사용, 기기 로컬 차단(`localModeration`) 필터 적용. **상세는 §6-A.**
> 모더레이션·비속어 필터·EULA·신고·차단은 **v3.0에서 이미 구현** — v3.1은 임계치 조정 등 강화만.

### 제외(차기)
소셜 로그인(추가 시 Apple 4.8 고려), 팔로우/댓글/좋아요, 환차익 반영(취소됨), 다기간 백테스트.

> **범위 메모**: `unlisted`(링크 공유)는 v3.0부터 지원하되 **`share_token` + `security definer` RPC**로
> 안전하게 구현한다(blanket SELECT 금지 — §4). 이전 계획이 "MVP에서 unlisted 제외"로 미뤘던 부분을,
> 토큰 방식으로 v3.0에 정식 포함한다.

---

## 2. 선결 작업 (구현 진입 전 1회)

### Supabase (계정 보유자 직접)
- [x] 프로젝트 생성 → **Project URL**, **anon public key** 확보 (Settings → API) — `app.json` extra 에 연결됨
- [x] **Supabase Auth 사용 안 함** — Provider 설정 불필요. 별명+비밀번호는 앱 테이블(`app_users`)로 자체 관리(§3,§4)
- [x] 둘러보기는 로그인 불필요(anon 키 + RLS 공개 읽기) — 설계로 충족
- [x] SQL Editor에서 §4 스키마 + `pgcrypto` 확장 + RLS + RPC 실행 — 완료(+`auth_nickname` search_path=`public, extensions` 패치)
- [ ] **UGC 마이그레이션 실행** — `reports.reporter` nullable + `report_shared` RPC(§4). 기존 스키마에 **추가 실행 필요**
- [ ] (보안) RPC 호출 레이트리밋으로 비밀번호 무차별 추측·신고 남용 방지 — **미완**
- [ ] (v3.1) Edge Functions 활성화 — 순위판 재계산 함수 배포(§6)
- [ ] Auth → Rate limits 확인 (가입 남용 방지) — **미완**

### 클라이언트 의존성
- [x] `@supabase/supabase-js`, `react-native-url-polyfill`, `expo-constants`(신규 설치), `@react-native-async-storage/async-storage`(기존)

### 키 관리
- anon 키는 공개돼도 **RLS로 보호** → `app.json`의 `expo.extra.supabaseUrl/supabaseAnonKey`.
  빌드 분리를 위해 `eas.json`의 `build.*.env`로도 주입, `Constants.expoConfig.extra`로 런타임 로드.
- **service_role 키는 절대 클라이언트에 넣지 않는다.** Edge Function 내부에서만 사용.

### 출시 분리 ⚠️
- v3는 **서버 전송이 시작**되므로 1.1.0과 격리. v3.0=1.2.0, v3.1=1.3.0 (1.2.0 통과 후) 권장.
- 1.2.0 제출 시 처리방침·App Privacy 갱신 동반(§7).

---

## 3. 인증 — 별명 + 비밀번호 (Supabase Auth 미사용·자체 저장, ✅ 확정 2026-06-18)

### 설계 원칙 — 최소 시퀀스
- **읽기(둘러보기·순위판 조회)**: **로그인 불필요.** anon 키 + RLS 공개 읽기만으로 동작(세션 없음).
- **쓰기(공유/자랑하기)**: 최초 1회 **별명 + 비밀번호** 등록만. **이메일·OTP·메일 수신 단계 없음.**
- **등록 순서**: ① 별명(랜덤 추천 or 직접 입력 + 중복 확인) → ② 비밀번호 → 끝.
- 같은 별명+비밀번호로 **어느 기기에서나 로그인** → 재설치·기기 변경에도 내 공유물/순위 유지.

### Supabase 클라이언트 (`src/services/supabase.js`) — 구현됨 ✅
GoTrue 세션을 쓰지 않으므로 세션 옵션을 모두 끈다(anon 키로 RPC/SELECT 호출만).
```js
import 'react-native-url-polyfill/auto';            // 최상단, fetch/URL 폴리필
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
export const supabase = createClient(extra.supabaseUrl ?? '', extra.supabaseAnonKey ?? '', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
export const isSupabaseConfigured = Boolean(extra.supabaseUrl && extra.supabaseAnonKey);
```

### Supabase Auth 미사용 — 별명·비밀번호를 우리 테이블에 직접 저장
GoTrue(Supabase Auth)를 쓰지 않는다. 별명·비밀번호는 **우리 DB(`app_users`)에 저장되는 데이터**이고,
모든 클라이언트는 **anon 키**로만 접근한다. 쓰기는 전부 `security definer` RPC가 별명+비밀번호를 검증한 뒤 수행한다.
- **🔒 비밀번호는 반드시 해시**: pgcrypto bcrypt(`crypt(pw, gen_salt('bf'))`). **평문 저장 금지.**
  검증도 DB 함수 내부에서만(`hash = crypt(pw, hash)`) — 해시는 클라이언트로 **절대 안 내려감**.
- 세션/JWT 없음: 클라이언트는 쓰기 때마다 별명+비밀번호를 HTTPS로 RPC에 전달(필요 시 기기 안전저장소에 캐시).
- 별명 유일성은 `app_users`의 `lower(nickname)` 유니크 인덱스로 보장(§4) → 사칭/중복 방지.

### 별명 생성 (`src/utils/nickname.js`)
- `suggestNickname()` — 형용사+명사+숫자 조합(예: "든든한코끼리42") 랜덤 추천으로 충돌 최소화.
- `normalizeNickname(nickname)` — 비교용 정규화(소문자, 공백·특수문자 정리).
- 직접 입력 시 `checkNicknameAvailable`로 가용성 확인.

### 등록/검증 흐름 & AuthContext (`src/context/AuthContext.js`)
- 최초 공유 시 `auth_nickname(별명, 비번)` RPC(§4):
  - 별명 없음 → **신규 등록**(해시 저장) 후 user_id 반환
  - 별명 있음 → 비번 일치 시 user_id 반환, 틀리면 거부(=별명 선점/비번 오류)
- 이후 수정·삭제·자랑하기: 같은 별명+비밀번호를 RPC에 동봉해 소유권 증명.
- 상태: `{ nickname, credentials, register(nickname,password), verify(nickname,password), checkNicknameAvailable(nickname) }`.
  `App.js`에서 `AuthProvider`로 트리 래핑.

### 데이터 영속성 / 한계 / 책임
- 별명+비밀번호는 **기기 독립** → 재설치·기기 변경에도 복구 가능(이전 "익명 전용"의 소실 문제 해결).
- ⚠️ **자체 관리 비용**: 비번 해시 보관·비교 정확성, 무차별 추측 방지(RPC 레이트리밋/시도 제한)는 **우리 책임**.
  (동일 UX를 Supabase Auth로 하면 GoTrue가 대신 처리 — 본 플랜은 'Auth 미사용·자체 저장' 방침을 택함.)
- ⚠️ **비밀번호 분실 시 복구 불가**(이메일 미수집). 등록 화면에 "재설정 불가, 꼭 기억하세요" 안내. 차기 복구 옵션.

---

## 4. 데이터 모델 + RLS + 링크공유 RPC (정확한 SQL)

```sql
create extension if not exists pgcrypto;   -- bcrypt 해시용

-- app_users: 별명 + 비밀번호 해시 (Supabase Auth 미사용 — 앱 자체 관리)
create table app_users (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 20),
  password_hash text not null,           -- ⚠️ bcrypt 해시만. 평문 저장 금지.
  created_at timestamptz default now()
);
-- 별명 유일성(대소문자 무시) — 로그인/소유권 키
create unique index app_users_nickname_lower on app_users (lower(nickname));

create table shared_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  visibility text not null default 'private'
    check (visibility in ('private','unlisted','public')),
  share_token uuid not null default gen_random_uuid(),   -- unlisted 링크 공유용 비밀 토큰
  base_currency text not null default 'KRW',
  holdings jsonb not null,            -- [{name, symbol, category, targetPercent}] — 금액/수량/현재가 없음
  return_6m numeric,                  -- ⚠️ 서버(Edge Function·service_role)만 기록
  return_computed_at timestamptz,
  on_leaderboard boolean not null default false,
  is_hidden boolean not null default false,   -- 신고 누적/모더레이션 시 숨김
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on shared_portfolios (visibility, on_leaderboard, return_6m desc);

-- 신고 / 차단 (UGC 1.2)
-- reporter 는 nullable: 비등록 열람자도 익명 신고 가능(아래 report_shared). 등록자는 1인 1신고.
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid references app_users on delete cascade,   -- null = 익명 신고
  portfolio_id uuid not null references shared_portfolios on delete cascade,
  reason text,
  created_at timestamptz default now(),
  unique (reporter, portfolio_id)             -- 1인 1신고(익명 null 은 중복 허용)
);
create table blocks (
  blocker uuid not null references app_users on delete cascade,
  blocked uuid not null references app_users on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker, blocked)
);

-- RLS: anon은 '공개 글 읽기'만. 모든 쓰기는 아래 security definer RPC로만(별명+비밀번호 검증).
alter table app_users         enable row level security;   -- 정책 없음 → anon 직접 접근 차단(해시 보호)
alter table shared_portfolios enable row level security;
alter table reports           enable row level security;   -- 정책 없음 → RPC로만
alter table blocks            enable row level security;   -- 정책 없음 → RPC로만

-- 공개 글만 읽기 허용(숨김 제외). 비공개/unlisted는 토큰 RPC로만(아래).
create policy sp_public_read on shared_portfolios for select
  using (visibility = 'public' and not is_hidden);

-- 공개 표시명 뷰 — password_hash 절대 노출 안 함(클라 조인용)
create view public_profiles as select id, nickname from app_users;

-- 별명+비밀번호 검증/등록 → user_id 반환 (해시 비교는 DB 내부에서만)
-- ⚠️ Supabase 는 pgcrypto(crypt/gen_salt)를 `extensions` 스키마에 둔다 → search_path 에 반드시 포함.
create or replace function auth_nickname(p_nickname text, p_password text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid; ph text;
begin
  select id, password_hash into uid, ph from app_users where lower(nickname) = lower(p_nickname);
  if uid is null then                       -- 신규 등록
    insert into app_users(nickname, password_hash)
      values (p_nickname, crypt(p_password, gen_salt('bf'))) returning id into uid;
    return uid;
  end if;
  if ph = crypt(p_password, ph) then return uid; end if;   -- 기존: 비번 일치
  raise exception 'invalid_credentials';                   -- 별명 선점 or 비번 오류
end; $$;

-- 게시: 별명+비번 검증 후 INSERT (수정/삭제/신고/차단도 동일하게 검증 RPC로)
create or replace function publish_portfolio(
  p_nickname text, p_password text,
  p_title text, p_base text, p_holdings jsonb, p_visibility text default 'private'
) returns shared_portfolios language plpgsql security definer set search_path = public as $$
declare uid uuid; row shared_portfolios;
begin
  uid := auth_nickname(p_nickname, p_password);
  insert into shared_portfolios(user_id, title, base_currency, holdings, visibility)
    values (uid, p_title, p_base, p_holdings, coalesce(p_visibility,'private'))
    returning * into row;
  return row;
end; $$;

-- unlisted 링크 공유: 토큰 아는 사람만 1건 조회(공개목록엔 안 잡힘)
create or replace function get_shared_by_token(p_token uuid)
returns setof shared_portfolios language sql security definer set search_path = public as $$
  select * from shared_portfolios where share_token = p_token and not is_hidden;
$$;

-- 익명 신고(별명/비번 불필요) + 신고 누적 3건 이상 자동 숨김 (UGC 1.2 모더레이션)
create or replace function report_shared(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  insert into reports(reporter, portfolio_id, reason) values (null, p_id, p_reason);
  select count(*) into cnt from reports where portfolio_id = p_id;
  if cnt >= 3 then
    update shared_portfolios set is_hidden = true where id = p_id;
  end if;
end; $$;
grant execute on function report_shared(uuid, text) to anon, authenticated;

-- return_6m / on_leaderboard 은 어떤 클라 입력 RPC에서도 받지 않음 → Edge Function(service_role)만 기록(§6).
```

**설계 메모**
- `holdings`는 **비중·종목 메타만**. 직렬화 단계(§5)에서 금액/수량/현재가 제거를 강제.
- **비밀번호는 `app_users.password_hash`에 bcrypt로만** 저장·비교(평문 금지, 클라로 해시 미노출). `app_users` 직접 접근은 RLS로 차단, 표시명은 `public_profiles` 뷰로만 노출.
- 모든 쓰기는 `security definer` RPC가 별명+비번을 검증한 뒤 수행 → anon이 남의 글을 못 건드림.
- `return_6m`/`on_leaderboard`은 **Edge Function(service_role)만** 기록 → 순위 조작 차단(클라 입력 RPC에 해당 칸 없음 + anon 직접 UPDATE는 RLS 차단).
- `is_hidden` + `reports` + `blocks`(app_users.id 기준) 로 1.2(UGC) 충족. 신고 임계치 누적 시 `is_hidden=true`(MVP: 수동/임계치, 차기: 자동).
- 순위판 쿼리: `... where visibility='public' and on_leaderboard and not is_hidden order by return_6m desc limit N`. 차단 필터는 클라가 `blocks`와 대조하거나 RPC에서 처리.

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
- **단위 테스트(필수)**: 출력에 `totalAmount`/`ownedShares`/`currentPrice` 키가 **절대 없음**을 단언.

---

## 6. 순위판 수익률 — 서버(Edge) 재계산 (✅ 확정, 2026-06-18)

**결정**: 순위판 수익률은 **오직 Edge Function(서버)에서만 계산·기록**한다.
클라이언트가 제출하는 수익률은 사용자가 언제든 위조해 1위를 만들 수 있어 순위판이 무의미해지므로,
**클라이언트 제출 경로는 두지 않는다.** 클라이언트는 `holdings`만 보내고, 수익률은 서버가 시세로 재계산한다.

```
[클라] "자랑하기" → shareApi.submitToLeaderboard(portfolioId, 별명, 비번)
        → Edge Function `recompute-return` 호출 (별명+비번 동봉, JWT 없음)
[서버] auth_nickname 으로 소유자 확인 → holdings 읽기 → Yahoo chart(6mo)로 v2 백테스트 재계산
        → service_role 로 return_6m / return_computed_at / on_leaderboard=true UPDATE
[클라] 순위판 새로고침 → 검증된 수익률로 정렬 노출
```

- Edge Function은 **v2 백테스트 로직을 서버에서 재현**(`src/utils/backtest.js`의 순수 계산을 Deno로 포팅 또는 공유).
- 소유권은 **별명+비밀번호(`auth_nickname`)로 확인**(GoTrue JWT 미사용). 클라이언트는 `return_6m`을 직접 쓰지 못함(§4 RLS + service_role 전용) → 단일 진실원 = 서버.
- 비용/레이트리밋: 자랑하기 호출 빈도 제한(예: 포트폴리오당 N시간 1회) + 결과 캐시(`return_computed_at`).
- **v3.0에서는 순위판이 없으므로 이 함수도 불필요** — v3.1에서 도입.

---

## 6-A. "둘러보기" 탭 (v3.1) — 순위 · 검색 · 더보기

다른 사람의 공개 포트폴리오를 구경하는 **단일 탭**. 4가지 요구사항을 한 화면(`BrowseScreen`)에서 처리한다.

### 화면 구성 (`src/screens/BrowseScreen.js`)
```
[ 둘러보기 ]
 ┌ 검색바: ( 별명 | 종목 ) 토글 + 입력 + 검색
 ├ (검색어 없을 때) 🏆 수익률 Top 5  ← 요구사항 ①
 │    1. 닉네임 · 제목 · +12.3%   (탭 → SharedViewer)
 │    ...
 ├ (검색 결과) 목록 (요구사항 ②/③)
 └ [ 더보기 ] ← 요구사항 ④ (10개씩 추가)
```
- 항목 탭 → `SharedViewer`(읽기전용, 비중만). 카드에 닉네임·제목·수익률(있으면)·대표 종목 미리보기.
- **기기 로컬 차단 필터**: `localModeration.getBlockedAuthors()` 로 가져와 `user_id` 가 차단 목록이면 클라이언트에서 제외.
- 본인 글 제외(선택): 로그인된 별명이 있으면 같은 닉네임 숨김.

### 데이터 흐름 / 정렬 / 페이지네이션
- 기본(검색어 없음): `browse_public(p_sort='return', limit=5, offset=0)` → 수익률 Top 5.
- "더보기": 같은 조건으로 `offset` 을 누적(+10), `limit=10` 으로 추가 호출 → 리스트에 append.
  반환 개수가 `limit` 과 같으면 더 있을 수 있으므로 "더보기" 버튼 유지, 적으면 숨김.
- 정렬: `return_6m` 내림차순(`nulls last`) → 동률/널은 최신순(`created_at desc`).
- 검색: 별명(②) / 종목(③) 중 하나로 필터. 검색 시에도 같은 정렬·더보기 사용.

### 신규 RPC — `browse_public` (§4 에 함께 둠)
공개 읽기는 RLS(`sp_public_read`)로도 가능하지만, **별명 조인 + 종목 검색 + share_token 비노출**을
한 번에 처리하기 위해 전용 `security definer` RPC 를 둔다(필요한 컬럼만 반환, `share_token` 제외).
```sql
-- 둘러보기: 공개 포트폴리오 목록 (순위/별명검색/종목검색/페이지네이션)
--  p_sort: 'return'(수익률순) | 'recent'(최신순)
--  p_nickname: 작성자 별명 부분검색(옵션, ②)
--  p_symbol:   보유 종목 티커 또는 종목명 부분검색(옵션, ③)
create or replace function browse_public(
  p_sort text default 'return',
  p_nickname text default null,
  p_symbol text default null,
  p_limit int default 5,
  p_offset int default 0
) returns table (
  id uuid, title text, nickname text, user_id uuid, base_currency text,
  holdings jsonb, return_6m numeric, return_computed_at timestamptz, created_at timestamptz
) language sql security definer set search_path = public as $$
  select s.id, s.title, u.nickname, s.user_id, s.base_currency,
         s.holdings, s.return_6m, s.return_computed_at, s.created_at
  from shared_portfolios s
  join app_users u on u.id = s.user_id
  where s.visibility = 'public' and not s.is_hidden
    and (p_nickname is null or u.nickname ilike '%' || p_nickname || '%')
    and (p_symbol is null or exists (
          select 1 from jsonb_array_elements(s.holdings) h
          where upper(h->>'symbol') = upper(p_symbol)
             or h->>'name' ilike '%' || p_symbol || '%'))
  order by
    case when p_sort = 'return' then s.return_6m end desc nulls last,
    s.created_at desc
  limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;
grant execute on function browse_public(text, text, text, int, int) to anon, authenticated;

-- (스케일 시) 종목 '심볼 정확 일치' 검색 가속용 — 종목명 부분검색엔 무효
create index if not exists shared_portfolios_holdings_gin on shared_portfolios using gin (holdings);
```

### 공개 가시성 + 수익률 계산 연계 (선결)
- `BrowseScreen` 에 뜨려면 포트폴리오가 **`visibility='public'`** 이어야 한다 → `ShareModal` 에
  "**공개로 자랑하기**" 옵션 추가(기존 `unlisted` 코드 공유와 별개 선택지).
- 요구사항 ①(수익률 Top 5)이 의미를 가지려면 공개 글에 **`return_6m` 이 있어야** 한다 →
  공개 게시/자랑하기 시 **Edge Function `recompute-return`(§6) 호출로 서버가 계산**해 채운다.
  (아직 계산 전인 공개 글은 `return_6m=null` 로 순위 뒤로 밀리고 최신순에 노출.)

### 신규/변경 코드 (v3.1)
| 파일 | 역할 |
|---|---|
| `src/screens/BrowseScreen.js` (신규) | 둘러보기 탭: 검색바 + Top5 + 결과 리스트 + 더보기 |
| `src/services/shareApi.js` (확장) | `browsePublic({ sort, nickname, symbol, limit, offset })` RPC 래퍼 |
| `src/components/ShareModal.js` (확장) | "공개로 자랑하기" 옵션(+ 게시 후 `recompute-return` 호출) |
| `src/navigation/AppNavigator.js` (확장) | 하단 탭에 **"둘러보기"** 추가 |
| `supabase/functions/recompute-return/` (신규) | 공개 게시 시 6개월 수익률 서버 계산(§6) |

---

## 7. App Store 컴플라이언스 (필수)

### 7-1. UGC — Guideline 1.2
닉네임·공유 포트폴리오·(v3.1)순위판은 사용자 생성 콘텐츠다.
- [x] **EULA 동의** — 최초 공유 전 "불쾌한 콘텐츠 무관용" 약관 동의(`ShareModal` 내 체크박스, 미동의 시 공유 불가).
- [x] **신고(report)** — `ViewSharedModal`에 신고 버튼 + **익명 신고 `report_shared` RPC(자격 불필요, 누구나 가능)**. 로컬 중복신고 방지(`localModeration`).
- [x] **차단(block)** — `ViewSharedModal`에 작성자 차단 → 기기 로컬 차단목록(`localModeration.blockAuthor`). v3.1 공개 피드/순위판에서 필터링에 사용.
- [x] **모더레이션** — `report_shared` 가 신고 누적 **3건 이상이면 `is_hidden=true` 자동 숨김**. + 운영자가 Supabase 대시보드에서 수동 검토(연락처 `xodn1311@gmail.com`).
- [x] **콘텐츠 필터** — 별명/제목 비속어 1차 필터(`moderation.containsBannedWord`, `ShareModal` 제출 시 차단).

> 2단계 출시 덕분에 v3.0은 공개 피드/순위판이 없어 노출 표면이 작다. 단, **링크 공유물도 UGC**이므로
> 신고/차단/EULA는 v3.0부터 갖춘다.

### 7-2. App Privacy 설문 (Data Not Collected → 수집 신고)
v3부터 수집 신고:
- **Identifiers → User ID**: user id (Linked, 추적 아님).
- **User Content → Other User Content**: 별명, 공유 포트폴리오(종목+비중), 제목.
- **이메일 미수집** — 별명+비밀번호 인증이라 Contact Info(이메일) 수집 신고 불필요. (합성 이메일은 내부 식별자일 뿐 사용자 메일 아님)
- 비밀번호는 **우리 DB에 bcrypt 해시**로 저장하는 인증 자격증명(평문 아님, 추적/광고 용도 아님).
- 용도: App Functionality / Account Management. **추적(Tracking) 아님.** 광고/분석 SDK 없음 유지.

### 7-3. 처리방침 / 심사 Notes 갱신 — 초안 준비됨 ✅ (게시는 1.2.0 제출 시)
- [x] **`docs/privacy-policy-v3.md`** 초안 작성 — 공유 시 전송 데이터(별명·비중·user id), bcrypt 해시,
  unpublish 가능, **이메일 미수집**·**금액/수량/현재가 미전송**, UGC 신고/차단. → **1.2.0 제출 시 `privacy-policy.md` 로 교체 게시.**
- [x] **`docs/app-review-notes.md`** 에 "(1.2.0/v3.0 제출용 추가 메모)" 부록 추가 — App Privacy 전환 + Notes 영문 문단 + 호스트 `*.supabase.co`.
- ⚠️ **라이브 `privacy-policy.md`(1.1.0, "데이터 미수집")는 1.1.0 가 살아있는 동안 변경하지 않는다.** 1.2.0 출시와 함께 교체.

---

## 8. 보안 / 무결성
- **RLS 검증** ✅(스모크): anon 의 `app_users` 직접 접근 차단, 공개 글만 SELECT. 쓰기는 별명+비번 검증 RPC로만.
- **순위 무결성**: 수익률은 Edge Function(service_role)만 기록(§6). 클라 입력 RPC에 `return_6m`/`on_leaderboard` 칸 없음 → 위조 불가.
- **링크 공유 비밀성**: `unlisted`는 토큰 RPC로만 단건 조회, 공개 목록 쿼리엔 안 잡힘.
- **남용 방지**: 가입/RPC rate limit(**미설정 — 선결 작업 §2**), (v3.1) 자랑하기 호출 빈도 제한.
- **service_role 키**: Edge Function 환경변수에만. 클라이언트 유입 금지(코드리뷰 체크).

---

## 9. 신규 코드 / 재사용 / 네비게이션

### 신규 파일 (상태)
| 파일 | 단계 | 상태 | 역할 |
|---|---|---|---|
| `src/services/supabase.js` | v3.0 | ✅ | anon 클라이언트 싱글톤(§3) — RPC/SELECT용, GoTrue 세션 미사용 |
| `src/services/shareApi.js` | v3.0 | ✅ | RPC 래퍼(별명+비번 동봉): `publishPortfolio`/`updatePortfolio`/`unpublishPortfolio`/`getSharedByToken`/`reportPortfolio`/`blockUser` |
| `src/utils/shareSerialize.js` | v3.0 | ✅ | 비중만 추출(§5) + 테스트 |
| `src/context/AuthContext.js` | v3.0 | ✅ | 별명+비밀번호 등록/검증(`auth_nickname` RPC), 자격 메모리 보관, `checkNicknameAvailable` |
| `src/utils/nickname.js` | v3.0 | ✅ | 랜덤 별명 추천 + 정규화 + 검증(§3) + 테스트 |
| `src/utils/moderation.js` | v3.0 | ✅ | 별명/제목 비속어 1차 필터(§7-1) + 테스트 |
| `src/utils/localModeration.js` | v3.0 | ✅ | 기기 로컬 차단목록 + 중복신고 방지(AsyncStorage) |
| `src/components/ShareModal.js` | v3.0 | ✅ | 별명(랜덤/직접)+비밀번호+EULA → 게시 → 공유 코드(구 `NicknameModal` 흡수) |
| `src/components/SharedViewer.js` | v3.0 | ✅ | 읽기전용 뷰어(도넛+리스트, 비중만) |
| `src/components/ViewSharedModal.js` | v3.0 | ✅ | 공유 코드로 열람 + 신고/차단(구 `SharedDetailScreen` 대체, 모달 방식) |
| `scripts/check-supabase.js` | v3.0 | ✅ | 라이브 스모크(등록/게시/토큰조회/비번오류/RLS/정리) |
| `src/screens/BrowseScreen.js` | v3.1 | ⬜ | "둘러보기" 탭: Top5 순위 + 별명/종목 검색 + 더보기(§6-A) |
| `browse_public` RPC + `shareApi.browsePublic` | v3.1 | ⬜ | 공개 목록 조회(순위/검색/페이지네이션, §6-A) |
| `ShareModal` "공개로 자랑하기" 옵션 | v3.1 | ⬜ | 공개 게시 + `recompute-return` 호출(§6-A) |
| `supabase/functions/recompute-return/` | v3.1 | ⬜ | 공개 게시 시 6개월 수익률 서버 계산(§6) |

> 메모: v3.0 은 공유 진입을 별도 탭/스택 대신 **통합 화면의 버튼 + 모달**(`ShareModal`/`ViewSharedModal`)로 구현했다.
> v3.1 은 하단 탭에 **"둘러보기"** 1개를 추가하고, 항목 탭 시 `SharedViewer` 로 읽기전용 표시(별도 상세 화면/스택 불필요).

### 재사용
- `src/utils/aggregate.js`(`aggregateAcrossAccounts`/`aggregateByCategory`) — 뷰어 비중 분포.
- `src/components/DonutChart.js` — 뷰어 차트.
- `src/screens/ConsolidatedScreen.js` — 렌더 로직을 `SharedViewer`로 추출해 공용화.
- `src/utils/backtest.js` — Edge Function 재계산 로직의 원본(서버 포팅).
- `src/components/ExportButtons.js` — "공유하기" 버튼 추가 위치 참고.

### 네비게이션
- `src/navigation/AppNavigator.js`: (v3.1) 하단 탭 **"공유"** 추가 → stack: `ShareDashboard → SharedDetail → Leaderboard`.
  v3.0에서는 탭 없이 계좌/통합 화면의 "공유하기" → 링크 생성 + `SharedDetail` 진입만.
- `App.js`: `AuthProvider` 래핑.

---

## 10. 테스트 / 검증
- [x] `npm test`: `shareSerialize`가 금액/수량/현재가를 **절대 포함하지 않음**(핵심), `shareApi` 페이로드 형태(supabase mock). + `nickname`. **전체 65개 통과.**
- [x] 라이브 스모크(`node scripts/check-supabase.js`): `auth_nickname`(등록/검증/틀린비번 거부), `publish`/`get_shared_by_token`, `public_profiles`(해시 미노출), **`app_users` 직접 SELECT 차단(RLS)**, 정리 — 9개 통과.
- [x] `return_6m`/`on_leaderboard` 위조 방지: 클라 입력 RPC에 해당 컬럼 없음 + anon 직접 UPDATE는 RLS 차단(트리거 불필요).
- [ ] (v3.1) Edge Function: 위조한 `return_6m` 제출해도 서버 재계산값으로 덮어쓰는지.
- [ ] (v3.1) `browse_public`: ① 수익률 desc Top5 정렬(널 뒤), ② 별명 부분검색, ③ 종목명/티커 검색, ④ limit/offset 페이지네이션, `share_token` 미반환 검증.
- [ ] 실기기: 별명+비밀번호 등록 → 공유 → 다른 기기에서 같은 별명+비밀번호로 내 공유물 관리(영속성).
- [ ] 둘러보기(v3.1): 로그인 없이 Top5/검색/더보기 조회, 차단한 작성자 제외.

---

## 11. 구현 순서 (권장)

**v3.0 (공유 + 뷰어 · 첫 서버 릴리스, 1.2.0)**
1. [x] deps + `supabase.js`(§3) + `nickname.js` + `AuthContext`(별명+비밀번호 RPC) + §4 스키마/RPC(pgcrypto) + `app.json extra`.
2. [x] `shareSerialize`(+테스트) + `shareApi`(publish/update/unpublish/getByToken) + `ShareModal`(별명+비밀번호+EULA).
3. [x] `SharedViewer` + `ViewSharedModal`(공유 코드로 열람) + 통합 화면 "공유" 버튼.
4. [x] UGC: 익명 신고(`report_shared`)+신고 3건 자동 숨김 · 비속어 필터(`moderation`) · 기기 로컬 차단(`localModeration`) · EULA(§7-1).
5. [~] 심사 문서: 초안 준비 완료(`privacy-policy-v3.md` + `app-review-notes` 부록, §7-3). **1.2.0 제출 시 라이브 게시** 남음.
6. [ ] 실기기 테스트: 공유 → 코드 → 다른 기기 열람, 신고/차단 동작 확인(§10).
7. [ ] (선결) RPC 레이트리밋 설정(비번 추측·신고 남용 방지, §2).

**v3.1 ("둘러보기" 탭, 1.3.0)**
6. `ShareModal` "공개로 자랑하기" 옵션(`visibility='public'`) + `recompute-return` Edge Function(§6)으로 `return_6m` 계산.
7. `browse_public` RPC + GIN 인덱스(§6-A) + `shareApi.browsePublic` 래퍼.
8. `BrowseScreen`: ① Top5 순위 · ② 별명 검색 · ③ 종목 검색 · ④ 더보기(+10) · 로컬 차단 필터. 하단 탭 "둘러보기" 추가.
9. 모더레이션 임계치 조정 + 심사 문서(공개 피드 반영) 갱신 → 1.3.0 제출.

---

## 12. 리스크 / 한계 (문서화)
- **자체 비밀번호 관리 책임** — bcrypt 해시 + RPC 레이트리밋으로 추측/유출 방지(Supabase Auth 위임 대비 우리가 직접 책임).
- **비밀번호 분실 시 복구 불가**(이메일 미수집) — 등록 화면 경고로 완화. 차기: 선택적 이메일/소셜 연동 복구
  (소셜 추가 시 Apple 4.8 — Sign in with Apple 동반 고려). 현재는 이메일/소셜이 없어 4.8 트리거 안 됨.
- 별명이 로그인/소유권 키 → 흔한 별명은 선점되어 있을 수 있음(랜덤 추천 + 가용성 확인으로 완화).
- 서버 재계산은 Yahoo 시세 의존(레이트리밋·결측 시 등재 보류). 배당·환차익·거래비용 미반영(v2 모델 승계, 6개월 고정).
- 모더레이션 MVP는 수동 검토 + 임계치 자동숨김. 신고량 증가 시 자동화(Edge Function) 필요.
- `unlisted` 토큰이 유출되면 해당 링크는 누구나 열람(설계상 "링크를 아는 사람" 공유).
- 익명 신고는 악용(특정 글 깎아내리기) 가능 → 자동 숨김은 신고 3건 임계치 + **운영자 수동 검토**로 보완. 임계치 조정·신고자 식별은 신고량 보며 강화.
- 비속어 필터는 1차 금지어 목록 수준(우회 가능). 신고/모더레이션이 2차 방어선.
- 기기 로컬 차단은 v3.0에선 기록만(공개 피드가 없어 가시 효과 없음) — v3.1 **둘러보기 탭에서 실제 필터링**.
- (v3.1) 공개 글에 `return_6m` 이 없으면 "수익률 Top5"가 비거나 최신순으로 채워짐 → 공개 게시 시 Edge 계산 필수(§6-A).
- (v3.1) 종목 검색의 **종목명 부분검색**은 GIN 인덱스로 가속 안 됨(전체 스캔) → 데이터 증가 시 심볼 정확검색 위주로 조정하거나 종목 인덱스 테이블 도입 검토.
- (v3.1) 공개 피드는 누구나 열람 → 노출 표면이 커지므로 신고/자동숨김/비속어 필터(v3.0)가 1차 방어, 운영 모니터링 강화 필요.
