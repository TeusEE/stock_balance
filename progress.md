# iOS 배포 진행 상황

> 마지막 업데이트: 2026-06-18
> 브랜치: `claude/stock-portfolio-rebalancing-app-LDvJ3`
> 관련 문서: [`docs/ios-deploy.md`](docs/ios-deploy.md) · [`docs/screenshots.md`](docs/screenshots.md)

App Store 배포 작업의 단계별 진행 상황을 기록합니다.

---

## 🚀 현재 상태 (2026-06-18)

- **v1.0.0 — App Store 출시 완료** (첫 심사 통과). Guideline 2.1·2.3·2.3.6 리젝션은 모두 해결됨.
- **v1.1.0 — App Store 배포 완료**. v2.0(보유 백테스트)·v2.1(N일 리밸런싱 백테스트)까지 포함하고,
  실기기 테스트에서 발견한 UX/버그(한글·ETF 검색, 키보드 닫기, 백테스트 캐시, 모달 닫기, 한글명 표시)를
  수정한 버전. 자세한 변경은 [`CHANGELOG.md`](CHANGELOG.md).
  - v2.2(환차익 FX)는 **취소**되어 미포함 — [`docs/roadmap.md`](docs/roadmap.md) 참조.
- **다음 단계**: v3는 방향을 재검토(리비전) 중. 상세 계획은 [`docs/v3-implementation-plan.md`](docs/v3-implementation-plan.md).

아래는 v1 첫 배포 당시의 단계별 기록(히스토리)입니다.

---

## ✅ 완료된 작업

| # | 항목 | 산출물 / 메모 |
|---|---|---|
| 1 | **스크린샷 자동 캡처 하니스** | `scripts/screenshots.sh`, `src/utils/screenshot.js`, `screenshots/01~05-*.png` (1320×2868, 6.9") |
| 2 | **배포 가이드 문서** | `docs/ios-deploy.md` (EAS/로컬 Xcode), `docs/screenshots.md` |
| 3 | **앱 아이콘** | `assets/icon.png` (정사각·불투명·풀블리드) + `app.json`의 `expo.icon` 연결 |
| 4 | **EAS 빌드 설정** | `eas.json` — production 프로필, `appVersionSource: remote` + `autoIncrement`(빌드번호 자동) |
| 5 | **EAS 프로젝트 링크** | `app.json`의 `extra.eas.projectId` = `748e89e0-8700-4a42-93b5-738f41f291ab` |
| 6 | **수출 규정(암호화) 선언** | `app.json`의 `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` (표준 HTTPS만 사용 → 면제) |
| 7 | **iOS production 빌드 성공** | EAS 클라우드 빌드 완료, `.ipa` 산출 (아래 참고) |
| 8 | **심사 리젝션(2.1) 대응 문서** | `docs/app-review-notes.md` (영문 Notes 원본), `docs/privacy-policy.md`, `docs/walkthrough.md` |
| 9 | **처리방침 URL 호스팅** | GitHub Pages(`/docs`) 활성화 → `https://teusee.github.io/stock_balance/privacy-policy.html` 정상 게시. App Store Connect에 URL + App Privacy("Data Not Collected") 등록 완료 |
| 10 | **실기기 테스트 발견 버그 수정(1.0.1)** | 숫자패드 닫기 / 백테스트 항목 수정 반영 / 모달 배경 탭으로 닫기 — 자세한 내용은 [`CHANGELOG.md`](CHANGELOG.md) |

### 빌드 산출물
- `.ipa`: https://expo.dev/artifacts/eas/wnEv52owwkwRsB6bY94ZYd.ipa
- ⚠️ EAS 아티팩트 링크는 일정 기간 후 만료될 수 있습니다. 만료 시 https://expo.dev → 프로젝트 → **Builds** 에서 다시 받거나 재빌드(`eas build`)하세요.

---

## ⬜ 다음에 할 일 (이어서) — 2.1 리젝 응답

> 첫 심사에서 **Guideline 2.1 Information Needed** 리젝션을 받음.
> 아래는 그 응답 절차. 자세한 영문 Notes/처리방침/녹화 가이드는
> [`docs/app-review-notes.md`](docs/app-review-notes.md) ·
> [`docs/privacy-policy.md`](docs/privacy-policy.md) ·
> [`docs/walkthrough.md`](docs/walkthrough.md) 참조.

### 0. 수정된 코드로 새 빌드 (1.0.1) — 녹화·재제출 전 필수
> 실기기 테스트에서 발견한 버그 수정(키보드/백테스트/모달)이 들어가 있어,
> **고친 빌드로 다시 만들어** TestFlight 설치 → 녹화해야 한다. 자세한 변경: [`CHANGELOG.md`](CHANGELOG.md)
- [ ] `eas build --platform ios --profile production --auto-submit`
      (Expo·Apple 로그인 필요 → 터미널에서 직접 실행)
- [ ] TestFlight 처리(10~30분) 후 아이폰에서 앱 **업데이트**
- [ ] 종목 추가창에서 숫자 입력 → 빈 곳 탭 시 키보드 닫힘 / 저장 버튼 안 가려짐 확인

### 1. 처리방침 URL 호스팅 (GitHub Pages) — ✅ 완료
- [x] GitHub > 레포 Settings > Pages → **Source: Deploy from a branch**,
      Branch: 현재 브랜치, Folder: `/docs`
- [x] `https://teusee.github.io/stock_balance/privacy-policy.html` 정상 게시 확인
- [x] App Store Connect → App Privacy → **Privacy Policy URL** 등록 + "Data Not Collected" 응답

### 2. 실기기 화면 녹화
- [ ] `docs/walkthrough.md` 시나리오대로 iPhone 실기기에서 화면 기록(60~90초)
- [ ] `.MOV` 파일을 App Store Connect → App Review Information → Attachments 에 첨부

### 3. App Review Information Notes 작성
- [ ] `docs/app-review-notes.md` 본문을 복사
- [ ] `[FILL IN]` 두 군데(테스트 디바이스, 처리방침 URL) 채우기
- [ ] Notes 필드에 붙여넣기

### 4. App Privacy 설문 — ✅ 완료
- [x] 모든 데이터 카테고리 **"Data Not Collected"** 로 답변
      (근거: 권한 요청 0건, 외부 호스트는 Yahoo Finance 1곳뿐, AsyncStorage 로컬 저장만)

### 5. 마케팅 메타데이터 (기존 미해결)
- [ ] 스크린샷 업로드 — `screenshots/01~05-*.png` (6.9") + `screenshots/ipad/` (iPad)
- [ ] 앱 설명 / 키워드 / 카테고리(Finance)
- [ ] 지원(Support) URL
- [ ] 연령 등급 설문

### 6. 재제출
- [ ] App Store Connect → Resolution Center 에서 **Reply** 하여 위 정보 전달
- [ ] (필요 시) 새 빌드 업로드 후 그 빌드로 심사 대상 변경
- [ ] 심사 통과 후 출시(자동/수동)

---

## 📌 남은 준비물 / 유의사항
- **개인정보 처리방침 URL**: 본문은 `docs/privacy-policy.md` 로 준비됨.
  GitHub Pages 활성화로 URL 확보(위 1단계 참고).
- **아이콘**: 현재 임시(1254×1254). 동작엔 문제없으나 최종본은 1024×1024 권장.
- **버전 관리**: marketing 버전은 `app.json`의 `version`(현재 `1.0.0`)에서 직접 올림. 빌드 번호는 EAS가 자동 증가.
- **로그인/빌드/제출**은 Apple 계정 인증이 필요해 터미널에서 직접 실행 (이 세션에선 프롬프트에 `!` 접두사로 실행 가능).
