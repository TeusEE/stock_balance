# iOS 배포 진행 상황

> 마지막 업데이트: 2026-06-01
> 브랜치: `claude/stock-portfolio-rebalancing-app-LDvJ3`
> 관련 문서: [`docs/ios-deploy.md`](docs/ios-deploy.md) · [`docs/screenshots.md`](docs/screenshots.md)

App Store 배포 작업의 단계별 진행 상황을 기록합니다. 내일 이어서 할 때 여기부터 보세요.

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

### 빌드 산출물
- `.ipa`: https://expo.dev/artifacts/eas/wnEv52owwkwRsB6bY94ZYd.ipa
- ⚠️ EAS 아티팩트 링크는 일정 기간 후 만료될 수 있습니다. 만료 시 https://expo.dev → 프로젝트 → **Builds** 에서 다시 받거나 재빌드(`eas build`)하세요.

---

## ⬜ 다음에 할 일 (이어서)

### 1. App Store Connect 업로드
```bash
eas submit --platform ios --profile production
```
- 가장 최근 빌드를 업로드. 또는 `--url https://expo.dev/artifacts/eas/wnEv52owwkwRsB6bY94ZYd.ipa` 로 위 .ipa 직접 지정 가능.
- 인증: **App Store Connect API Key** 권장 (ASC → Users and Access → Integrations).
- 앱 레코드가 없으면 자동 생성 여부를 물어봄 → Yes 가능.

### 2. App Store Connect 메타데이터 (웹)
https://appstoreconnect.apple.com → 앱:
- [ ] 스크린샷 업로드 — `screenshots/01~05-*.png` (6.9" 필수)
- [ ] 앱 설명 / 키워드 / 카테고리(Finance)
- [ ] **개인정보 처리방침 URL** ⚠️ *심사 제출 필수 — 아직 준비 안 됨*
- [ ] 지원(Support) URL
- [ ] 개인정보 설문 → "데이터 미수집(Data Not Collected)" (서버 전송 없이 기기 저장만)
- [ ] 연령 등급 설문

### 3. 테스트 & 제출
- [ ] (권장) **TestFlight**로 실기기 검증
- [ ] 빌드 연결 → **심사 제출(Submit for Review)**
- [ ] 심사 통과 후 출시(자동/수동)

---

## 📌 남은 준비물 / 유의사항
- **개인정보 처리방침 URL**: 심사 제출의 필수 항목. 간단한 정적 페이지라도 미리 준비 필요.
- **아이콘**: 현재 임시(1254×1254). 동작엔 문제없으나 최종본은 1024×1024 권장.
- **버전 관리**: marketing 버전은 `app.json`의 `version`(현재 `1.0.0`)에서 직접 올림. 빌드 번호는 EAS가 자동 증가.
- **로그인/빌드/제출**은 Apple 계정 인증이 필요해 터미널에서 직접 실행 (이 세션에선 프롬프트에 `!` 접두사로 실행 가능).
