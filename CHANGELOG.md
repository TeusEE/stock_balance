# 변경 이력 (Changelog)

이 프로젝트의 주요 변경사항을 기록합니다.
버전은 `app.json`의 marketing 버전 기준이며, 빌드 번호는 EAS가 자동 증가합니다.

---

## [Unreleased] — 1.0.1 빌드 예정

> App Store 2.1(Information Needed) 재제출을 준비하며, 실기기 테스트에서 발견한
> UX 문제와 백테스트 버그를 수정했습니다. 아래 항목은 모두 다음 iOS 빌드
> (`eas build --platform ios --profile production --auto-submit`)에 포함됩니다.

### 수정 (Fixed)
- **숫자 입력 후 키보드를 내릴 수 없던 문제** — `decimal-pad` 입력칸(현재가·보유수량·비중,
  총 금액)은 iOS에서 "완료/Return" 키가 없어 키보드가 갇혔고, 항목 편집 모달에서는
  키보드가 저장 버튼까지 가렸습니다.
  - 항목 편집 모달(`ItemEditorModal`): 입력칸 바깥(배경·빈 공간)을 탭하면 키보드가
    닫히고, `KeyboardAvoidingView`로 시트를 밀어올려 저장 버튼이 가려지지 않도록 함.
    (iOS `InputAccessoryView`는 RN `Modal` 내부에서 렌더되지 않아 모달용으로는
    사용 불가 — 해당 한계를 우회.)
  - 계좌 화면 총 금액칸(`AccountScreen`): 숫자패드 위에 "완료" 막대
    (`InputAccessoryView`) 추가. (모달 밖이라 정상 동작)
- **항목 수정이 백테스트에 반영되지 않던 문제** — 6개월 백테스트 결과 캐시가
  `activeAccount.id`가 바뀔 때만 무효화되어, 같은 계좌에서 비중·종목을 수정/추가/삭제해도
  옛 결과가 그대로 표시됐습니다. 캐시 무효화 기준을 항목 입력값 시그니처
  (`심볼:종목명:목표비중`)로 변경해, 수정 시 다시 계산되도록 함. (`AccountScreen`)
  - 통합(Consolidated) 화면은 이미 `holdings` 기준으로 무효화하고 있어 정상 동작 확인.

### 개선 (Changed)
- **오버레이 모달 배경 탭으로 닫기** — 화면 위로 떠오르는 바텀시트 모달의 어두운 배경을
  누르면 닫히도록 함(iOS 표준 동작). 적용: 백테스트 결과(`BacktestModal`),
  종목 검색(`StockSearchModal`), 항목 추가/편집(`ItemEditorModal`).
  시트 본체를 누르면 닫히지 않으며, 항목 편집 모달은 배경 탭 시 키보드를 먼저 닫습니다.

### 문서 (Docs)
- `docs/privacy-policy.md`에 Jekyll front matter 추가 — GitHub Pages가 Markdown을
  HTML로 렌더링하도록 해, App Store에 등록할 처리방침 URL
  (`/privacy-policy.html`)이 정상적으로 열리도록 함.

---

## [1.0.0] — 첫 제출 (App Store 심사)

- N일 주기 리밸런싱 백테스트(v2.1), 6개월 buy-and-hold 백테스트(v2.0)
- 계좌별 포트폴리오 구성·목표 비중·권장 매수 주수 계산
- 모든 계좌 통합(Consolidated) 종목별/그룹별 보기
- Yahoo Finance 공개 API로 종목 검색·현재가·과거 시세 조회
- JSON 내보내기, 스크린샷 자동 캡처 하니스, EAS 빌드/배포 설정
