#!/usr/bin/env bash
set -euo pipefail
GG_ROOT=$(cd "$(dirname "$0")/.." && pwd)
GG_MODE=${1:-debug}
case "$GG_MODE" in debug) GG_TASK=assembleDebug; GG_NAME=GoodGround-Android-Test;; release) GG_TASK=assembleRelease; GG_NAME=GoodGround-Android;; *) echo 'Usage: bash scripts/build-android.sh [debug|release]' >&2; exit 2;; esac
if [ "$GG_MODE" = release ] && [ -z "${GG_ANDROID_KEYSTORE:-}" ] && [ ! -f "$GG_ROOT/android/.signing/goodground.jks" ]; then
  echo 'Release signing is not configured. See ANDROID.md. The debug build needs no signing setup.' >&2; exit 2
fi
bash "$GG_ROOT/android/gradlew" --project-dir "$GG_ROOT/android" --no-daemon "$GG_TASK" "lint${GG_MODE^}"
GG_APK="$GG_ROOT/android/app/build/outputs/apk/$GG_MODE/app-$GG_MODE.apk"
test -s "$GG_APK"
mkdir -p "$GG_ROOT/build/android"
cp "$GG_APK" "$GG_ROOT/build/android/$GG_NAME.apk"
(cd "$GG_ROOT/build/android" && sha256sum "$GG_NAME.apk" > "$GG_NAME.apk.sha256")
echo "Created $GG_ROOT/build/android/$GG_NAME.apk"
