#!/usr/bin/env bash
#
# App Store 스크린샷 자동 캡처 스크립트
# ---------------------------------------------------------------------------
# iOS 시뮬레이터에 앱을 띄우고, 데모 시드 데이터로 채워진 여러 화면(씬)을
# 1320×2868 (App Store 6.9" 필수 규격) 으로 캡처합니다.
#
# 씬 상태는 모두 src/utils/screenshot.js 에서 EXPO_PUBLIC_SCREENSHOT_SCENE
# 환경변수로 제어됩니다. 프로덕션 빌드에는 영향이 없습니다.
#
# 사용법:
#   ./scripts/screenshots.sh                # 기본 디바이스로 전체 캡처
#   DEVICE="iPhone 16 Pro Max" ./scripts/screenshots.sh
#   ./scripts/screenshots.sh browse   # 특정 씬만
#
# 요구사항: Xcode + iOS 시뮬레이터, Node, (최초 1회) CocoaPods.
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# --- 설정 -------------------------------------------------------------------
DEVICE="${DEVICE:-iPhone 17 Pro Max}"     # 기본: 6.9" 아이폰 (1320×2868)
#   iPad 예: DEVICE="iPad Air 13-inch (M4)"  → 13" 규격 (2064×2752)
BUNDLE_ID="${BUNDLE_ID:-com.stockbalance.app}"
METRO_PORT="${METRO_PORT:-8081}"

# 출력 폴더: iPad는 screenshots/ipad/, 아이폰은 기존대로 screenshots/
case "$DEVICE" in
  *iPad*) DEFAULT_OUT_DIR="$ROOT/screenshots/ipad" ;;
  *)      DEFAULT_OUT_DIR="$ROOT/screenshots" ;;
esac
OUT_DIR="${OUT_DIR:-$DEFAULT_OUT_DIR}"
METRO_LOG="$(mktemp -t stockbalance-metro)"

# 캡처할 씬 목록 (macOS 기본 bash 3.2 호환 위해 연관배열 대신 case 사용)
SCENES=(account consolidated browse)

# 인자로 특정 씬만 지정 가능
if [ "$#" -gt 0 ]; then
  SCENES=("$@")
fi

# 씬 → 출력 파일명
out_file_for() {
  case "$1" in
    account)              echo "01-account-rebalance.png" ;;
    consolidated)         echo "02-consolidated-account.png" ;;
    browse)               echo "03-browse-portfolios.png" ;;
    *)                    echo "${1}.png" ;;
  esac
}

mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR"/0*.png

log() { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }

cleanup() {
  log "Metro 종료 및 정리"
  pkill -f "expo start" 2>/dev/null || true
  [ -f "$METRO_LOG" ] && rm -f "$METRO_LOG"
}
trap cleanup EXIT

# --- 시뮬레이터 부팅 --------------------------------------------------------
log "시뮬레이터 '$DEVICE' 부팅"
UDID="$(xcrun simctl list devices available | grep -F "$DEVICE (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')"
if [ -z "$UDID" ]; then
  echo "❌ 사용 가능한 '$DEVICE' 시뮬레이터를 찾지 못했습니다." >&2
  echo "   xcrun simctl list devices available 로 확인 후 DEVICE 환경변수로 지정하세요." >&2
  exit 1
fi
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator
xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1 || true

# 상태바를 마케팅용으로 고정 (9:41, 풀 배터리/신호)
xcrun simctl status_bar "$UDID" override \
  --time "9:41" \
  --batteryState charged --batteryLevel 100 \
  --wifiBars 3 --cellularBars 4 2>/dev/null || true

# --- 앱 빌드 & 설치 (없을 때만) ---------------------------------------------
# 시뮬레이터 빌드(Debug-iphonesimulator)는 iPhone/iPad 공용이므로, 이미 만들어 둔
# .app 이 있으면 재빌드 없이 다른 디바이스(예: iPad)에 그대로 설치해 재사용한다.
if xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" >/dev/null 2>&1; then
  log "앱이 이미 설치돼 있어 빌드를 건너뜁니다"
else
  PREBUILT_APP="$(find "$HOME/Library/Developer/Xcode/DerivedData" \
    -path '*Build/Products/Debug-iphonesimulator/*.app' -maxdepth 8 -name '*.app' 2>/dev/null \
    | grep -i stockbalance | head -1)"
  if [ -n "$PREBUILT_APP" ]; then
    log "기존 시뮬레이터 빌드 재사용: $(basename "$PREBUILT_APP") → 설치"
    xcrun simctl install "$UDID" "$PREBUILT_APP"
  else
    log "설치된 앱/기존 빌드가 없어 빌드합니다 (expo run:ios — 최초 1회는 수 분 소요)"
    EXPO_NO_TELEMETRY=1 npx expo run:ios --device "$UDID" --no-bundler
  fi
fi

# --- Metro 시작 헬퍼 --------------------------------------------------------
start_metro() {
  local scene="$1"
  pkill -f "expo start" 2>/dev/null || true
  sleep 1
  : > "$METRO_LOG"
  EXPO_PUBLIC_SCREENSHOT_SCENE="$scene" EXPO_NO_TELEMETRY=1 \
    npx expo start --port "$METRO_PORT" --clear > "$METRO_LOG" 2>&1 &
  # Metro 준비 대기
  for _ in $(seq 1 60); do
    grep -qiE "Waiting on http|Metro waiting|Logs for your project" "$METRO_LOG" && return 0
    sleep 1
  done
  echo "❌ Metro 시작 시간 초과" >&2; cat "$METRO_LOG" >&2; exit 1
}

launch_and_wait_bundle() {
  # METRO_LOG 는 씬마다 start_metro 에서 비워지므로, "Bundled" 가 보이면
  # 이번 씬 번들이 완료된 것.
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  sleep 1
  # 개발 클라이언트를 localhost Metro 로 연결 (직전 앱 복귀 표시 없이 콜드 런치)
  xcrun simctl openurl "$UDID" \
    "$BUNDLE_ID://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${METRO_PORT}" >/dev/null 2>&1 || true
  for _ in $(seq 1 90); do
    grep -qi "Bundled" "$METRO_LOG" 2>/dev/null && break
    sleep 1
  done
  sleep 5   # 렌더/애니메이션 정착
}

# --- 씬별 캡처 --------------------------------------------------------------
for scene in "${SCENES[@]}"; do
  out="$(out_file_for "$scene")"
  log "씬 '$scene' → $out"
  start_metro "$scene"
  launch_and_wait_bundle
  xcrun simctl io "$UDID" screenshot "$OUT_DIR/$out" >/dev/null
  log "저장: screenshots/$out"
done

# 상태바 override 해제
xcrun simctl status_bar "$UDID" clear 2>/dev/null || true

log "완료 — $OUT_DIR 에 ${#SCENES[@]}개 스크린샷 저장"
ls -1 "$OUT_DIR"
