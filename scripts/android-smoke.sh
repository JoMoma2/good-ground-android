#!/usr/bin/env bash
# Run against an already booted Android emulator. Never use this against personal data.
set -euo pipefail
GG_ROOT=$(cd "$(dirname "$0")/.." && pwd)
GG_APK=${1:-"$GG_ROOT/build/android/GoodGround-Android-Test.apk"}
GG_PACKAGE=local.goodground.training.debug
GG_ADB=${ANDROID_HOME:?Set ANDROID_HOME}/platform-tools/adb
GG_SERIAL=${ANDROID_SERIAL:?Set ANDROID_SERIAL to a disposable Android emulator}
case "$GG_SERIAL" in emulator-*) ;; *) echo 'This script only clears a disposable emulator test edition.' >&2; exit 2;; esac
[ "$("$GG_ADB" shell getprop ro.kernel.qemu | tr -d '\r')" = 1 ] || exit 2
GG_OUT="$GG_ROOT/build/android-validation"
mkdir -p "$GG_OUT"
"$GG_ADB" install -r "$GG_APK"
# Only the separate test edition is cleared. The personal edition is never touched.
"$GG_ADB" shell pm clear "$GG_PACKAGE" > /dev/null
"$GG_ADB" shell am start -n "$GG_PACKAGE/local.goodground.training.MainActivity" --ez good_ground_smoke true
GG_FOUND=false
for GG_ATTEMPT in $(seq 1 90); do
  if "$GG_ADB" exec-out run-as "$GG_PACKAGE" cat files/smoke-result.json > "$GG_OUT/smoke-result.json" 2>/dev/null && node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"))' "$GG_OUT/smoke-result.json" 2>/dev/null; then GG_FOUND=true; break; fi
  sleep 2
done
"$GG_ADB" exec-out screencap -p > "$GG_OUT/screen.png"
"$GG_ADB" logcat -d > "$GG_OUT/logcat.txt"
[ "$GG_FOUND" = true ] || { echo 'No Android smoke result. See logcat and screenshot.' >&2; exit 1; }
node - "$GG_OUT/smoke-result.json" "$GG_ROOT/app/web/data.json" <<'JS'
const fs=require('node:fs'),assert=require('node:assert/strict'),r=JSON.parse(fs.readFileSync(process.argv[2]));
assert.equal(r.loaded,true);assert.equal(r.bridge,true);assert.equal(r.lesson,true);assert.equal(r.restored,true);assert.deepEqual(r.errors,[]);
const D=JSON.parse(fs.readFileSync(process.argv[3]));assert.equal(r.skills,D.skills.length);assert.equal(r.steps,D.skills.reduce((n,s)=>n+s.steps.length,0));assert.equal(r.nativeStore?.passed,true);
console.log('Android WebView, lesson navigation, backups and atomic private file store passed.');
JS
"$GG_ADB" shell am force-stop "$GG_PACKAGE"
"$GG_ADB" shell am start -n "$GG_PACKAGE/local.goodground.training.MainActivity"
sleep 3
"$GG_ADB" exec-out run-as "$GG_PACKAGE" cat no_backup/GoodGround/progress.json > "$GG_OUT/reopened-progress.json"
node - "$GG_OUT/reopened-progress.json" <<'JS'
const fs=require('node:fs'),assert=require('node:assert/strict'),s=JSON.parse(fs.readFileSync(process.argv[2]));assert.equal(s.progress['NAME-1'].status,'Consistent - move on');
console.log('Android saved progress survives process restart.');
JS
