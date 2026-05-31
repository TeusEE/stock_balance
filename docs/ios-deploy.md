# iOS 빌드 & App Store 배포 가이드

이 문서는 **Stock Balance** (Expo SDK 56 managed 워크플로) 앱을 iOS로 빌드해
App Store에 배포하는 전 과정을 정리합니다.

- 권장 경로: **EAS Build + EAS Submit** (클라우드 빌드, 인증서 자동 관리)
- 대안 경로: **로컬 Xcode 빌드** (Mac + Xcode 직접 아카이브)

> 처음 한 번만 거치는 설정(❶~❹)과, 배포할 때마다 반복하는 단계(➎~➑)로 나눠 읽으세요.

---

## 0. 사전 준비물 (필수)

| 항목 | 설명 |
|---|---|
| **Apple Developer Program** | 연 $99. App Store 배포에 필수. https://developer.apple.com/programs/ |
| **App Store Connect 계정** | 위 멤버십에 포함. 앱 등록/심사 제출용. https://appstoreconnect.apple.com |
| **Apple ID (2FA 활성화)** | 빌드 업로드/제출 시 사용 |
| **Mac** | 로컬 Xcode 빌드 시 필요. EAS 클라우드 빌드만 쓰면 Mac 없이도 가능 |
| **Node + npm** | `npm install` 선행 |

> 번들 ID는 이미 `app.json`에 `com.stockbalance.app`로 지정돼 있습니다.
> App Store Connect에서 이 ID로 앱을 등록합니다. (EAS가 자동 등록해 줄 수도 있음)

---

## ❶ 앱 아이콘 / 스플래시 추가 (⚠️ 현재 누락 — 배포 전 반드시 해결)

현재 프로젝트에는 **`assets/` 폴더와 앱 아이콘이 없습니다.** App Store는 **1024×1024
앱 아이콘**이 필수이므로 그대로 빌드하면 Expo 기본 아이콘이 들어가거나 심사에서 반려됩니다.

1. 아이콘 이미지를 준비합니다 (정사각형, 투명 배경 X, 모서리 둥글림 X — Apple이 자동 처리).
   - `assets/icon.png` — **1024×1024** (앱 아이콘)
   - `assets/splash.png` — 스플래시용 (선택, 예: 1284×2778 또는 단순 로고)
   - `assets/adaptive-icon.png` — Android용 (선택)

2. `app.json`에 아이콘/스플래시를 연결합니다:

```jsonc
{
  "expo": {
    "name": "Stock Balance",
    "slug": "stock-balance",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",                // ← 추가
    "userInterfaceStyle": "automatic",
    "splash": {                                  // ← 추가 (expo-splash-screen)
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0E1116"               // 앱 배경(다크)과 맞춤. theme.js의 colors.bg 참고
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.stockbalance.app",
      "buildNumber": "1"                          // ← 추가 (빌드마다 증가, 아래 ➐ 참고)
    },
    ...
  }
}
```

> 아이콘 한 장(1024)만 있으면 `npx expo prebuild`가 필요한 모든 크기를 생성합니다.
> 빠르게 임시 아이콘이 필요하면 단색 배경 + 앱 이름/심볼로 1024 PNG를 만들어도 됩니다.

---

## ❷ 개인정보 / 권한 점검

이 앱은 **네트워크(Yahoo Finance 시세 조회)** 와 **로컬 저장(AsyncStorage)** 만 사용합니다.

- 위치/카메라/연락처 등 민감 권한을 쓰지 않으므로 `Info.plist` 권한 설명 추가가 필요 없습니다.
- 모든 외부 호출은 HTTPS이므로 ATS(App Transport Security) 예외 설정도 불필요합니다.
- App Store Connect의 **앱 개인정보(Privacy)** 설문에서는 일반적으로
  **"데이터를 수집하지 않음(Data Not Collected)"** 으로 신고할 수 있습니다.
  (포트폴리오 데이터는 서버 전송 없이 기기에만 저장됨 → 실제 구현과 일치하는지 확인 후 신고)

---

## ❸ EAS CLI 설치 & 로그인

```bash
npm install -g eas-cli      # 또는 매번 npx eas-cli 사용
eas login                   # Expo 계정으로 로그인 (없으면 expo.dev에서 무료 가입)
```

---

## ❹ EAS 빌드 설정 생성

```bash
eas build:configure
```

→ `eas.json`이 생성됩니다. 아래는 이 프로젝트에 맞는 예시입니다
(`production` 프로필이 App Store 제출용):

```jsonc
{
  "cli": { "version": ">= 3.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"          // 임시 .ipa (TestFlight 외 내부 테스트)
    },
    "production": {
      "autoIncrement": true               // buildNumber 자동 증가
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## ➎ iOS 빌드 (배포할 때마다)

```bash
eas build --platform ios --profile production
```

- 처음 실행하면 **iOS 인증서/프로비저닝 프로파일**을 EAS가 자동 생성·관리할지 묻습니다 → **Yes** 권장.
  (Apple Developer 계정 로그인 필요. 수동 관리도 가능)
- 빌드는 EAS 클라우드에서 진행되며, 완료되면 `.ipa` 다운로드 링크가 나옵니다.
- 빌드 상태: https://expo.dev → 프로젝트 → Builds

> Mac이 없어도 됩니다. 클라우드에서 빌드됩니다.

---

## ➏ App Store Connect에 앱 레코드 생성 (최초 1회)

1. https://appstoreconnect.apple.com → **My Apps → ＋ → New App**
2. 입력:
   - Platform: **iOS**
   - Name: **Stock Balance** (App Store에 표시될 이름, 중복 불가)
   - Primary Language: **Korean**
   - Bundle ID: **com.stockbalance.app** (목록에 없으면 EAS 빌드가 자동 등록했거나, Developer 포털에서 먼저 등록)
   - SKU: 임의 고유값 (예: `stock-balance-001`)
3. 앱 정보 작성:
   - **스크린샷** — `docs/screenshots.md` 참고. `./scripts/screenshots.sh`로 생성한
     `screenshots/01~05-*.png`(6.9" 1320×2868)를 업로드. (6.9"만 필수)
   - 설명, 키워드, 카테고리(예: Finance), 지원 URL, 개인정보 처리방침 URL
   - 연령 등급(App Store Rating) 설문
   - 가격(무료/유료)

---

## ➐ 빌드 업로드 (EAS Submit)

```bash
eas submit --platform ios --profile production
```

- 가장 최근 EAS 빌드(또는 `--path`로 로컬 .ipa 지정)를 App Store Connect로 업로드합니다.
- 인증 방법: **App Store Connect API Key**(권장) 또는 Apple ID + 앱 암호.
  - API Key 발급: App Store Connect → Users and Access → Integrations → App Store Connect API
- 업로드 후 App Store Connect에서 처리(프로세싱)에 수 분~수십 분 소요됩니다.

### 버전/빌드 번호 규칙
- **version** (`app.json`의 `expo.version`, 예 `1.0.0`) = 사용자에게 보이는 버전. App Store 신규 버전마다 올림.
- **buildNumber** (`expo.ios.buildNumber`) = 같은 version 내에서 업로드마다 **반드시 증가**해야 함.
  - `eas.json`의 `production.autoIncrement: true`를 쓰면 EAS가 자동으로 올려 줍니다.

---

## ➑ TestFlight 테스트 → 심사 제출

1. **TestFlight** (선택이지만 권장): 업로드된 빌드를 내부/외부 테스터에게 배포해 실기기 검증.
2. App Store Connect → 해당 버전 → **빌드 선택** → 메타데이터/스크린샷 확인.
3. **심사에 제출(Submit for Review)**.
   - "수출 규정(Export Compliance)": 표준 HTTPS 암호화만 사용 → 보통 **예외(면제)** 선택 가능.
4. 심사 통과 후 **수동/자동 출시** 선택 → App Store 공개.

---

## 대안 경로: 로컬 Xcode 빌드

Mac + Xcode로 직접 아카이브하려는 경우:

```bash
# 1) 네이티브 프로젝트 생성 (ios/ 는 .gitignore 처리되어 있음 → 언제든 재생성)
npx expo prebuild -p ios

# 2) 의존성(CocoaPods) 설치는 prebuild가 자동 수행. 워크스페이스 열기:
open ios/StockBalance.xcworkspace
```

Xcode에서:
1. 좌측 타깃 **StockBalance → Signing & Capabilities** → **Team** 선택(자동 서명 권장).
2. 상단 디바이스를 **Any iOS Device (arm64)** 로 변경.
3. 메뉴 **Product → Archive**.
4. Organizer 창에서 **Distribute App → App Store Connect → Upload**.
5. 이후는 위 ➏~➑ 과 동일(App Store Connect에서 메타데이터/스크린샷/심사).

> 로컬 빌드 시에도 버전/빌드 번호 규칙(➐)은 동일합니다. `app.json`에서 올린 뒤
> `expo prebuild --clean`으로 다시 생성하거나 Xcode에서 직접 수정합니다.

---

## 배포 체크리스트 (요약)

매 배포 때 빠르게 확인:

- [ ] `app.json`의 `version` / `ios.buildNumber` 적절히 증가 (autoIncrement 사용 시 build는 자동)
- [ ] 앱 아이콘(`assets/icon.png` 1024) 존재 — ❶
- [ ] 변경 사항 커밋 & 테스트 통과 (`npm test`)
- [ ] `eas build --platform ios --profile production`
- [ ] 스크린샷 최신화 (`./scripts/screenshots.sh`) — UI가 바뀐 경우
- [ ] `eas submit --platform ios --profile production`
- [ ] App Store Connect에서 메타데이터/스크린샷 확인 → 심사 제출

---

## 참고 링크

- Expo — iOS 배포: https://docs.expo.dev/submit/ios/
- Expo — EAS Build: https://docs.expo.dev/build/setup/
- Expo — 앱 아이콘/스플래시: https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/
- App Store 심사 가이드라인: https://developer.apple.com/app-store/review/guidelines/
- 스크린샷 자동 캡처: [`docs/screenshots.md`](screenshots.md)
