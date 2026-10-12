#!/usr/bin/env bash
# Source-bound, disposable Android TV virtual-device gate. No user's device or account.
set -euo pipefail
apk='android-tv-shell/app/build/outputs/apk/debug/app-debug.apk'
test -s "$apk"
command -v sdkmanager >/dev/null
command -v avdmanager >/dev/null
command -v adb >/dev/null
if [[ ! -r /dev/kvm || ! -w /dev/kvm ]]; then
  echo 'ANDROID_TV_EMULATOR_BLOCKED_KVM_UNAVAILABLE'
  exit 2
fi
sdkmanager --install emulator >/dev/null
emulator_bin="${ANDROID_HOME:?}/emulator/emulator"
if [[ ! -x "$emulator_bin" ]]; then
  echo 'ANDROID_TV_EMULATOR_BLOCKED_SDK_BINARY_NOT_INSTALLED'
  exit 2
fi
if ! "$emulator_bin" -accel-check; then
  echo 'ANDROID_TV_EMULATOR_BLOCKED_HOST_ACCELERATOR'
  exit 2
fi
available="$(sdkmanager --list | grep -Eo 'system-images;android-(30|31|32|33|34|35);android-tv;(x86|x86_64)' | sort -Vu || true)"
if [[ -z "$available" ]]; then
  echo 'ANDROID_TV_EMULATOR_BLOCKED_NO_APPROVED_TV_IMAGE'
  exit 2
fi
chosen="$(printf '%s\n' "$available" | tail -1)"
printf 'TV system-image selected: %s\n' "$chosen"
sdkmanager --install "$chosen" >/dev/null
if avdmanager list device -c | grep -Fxq 'tv_1080p'; then
  tv='tv_1080p'
elif avdmanager list device -c | grep -Fxq 'tv_720p'; then
  tv='tv_720p'
else
  echo 'ANDROID_TV_EMULATOR_BLOCKED_NO_TV_DEVICE_PROFILE'
  exit 2
fi
printf 'no\n' | avdmanager create avd -n enhanced_tv_qa -k "$chosen" -d "$tv" --force >/dev/null
"$emulator_bin" -avd enhanced_tv_qa -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-snapshot -accel on -wipe-data >/tmp/enhanced-tv-emulator.stdout 2>&1 &
emu_pid=$!
cleanup() {
  adb emu kill >/dev/null 2>&1 || true
  kill "$emu_pid" >/dev/null 2>&1 || true
  wait "$emu_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT
if ! timeout 240 bash -c 'until adb devices | grep -q "emulator-[0-9]*[[:space:]]*device" && [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\''\r'\'')" == 1 ]]; do sleep 3; done'; then
  echo 'ANDROID_TV_EMULATOR_BLOCKED_BOOT_TIMEOUT'
  if ! kill -0 "$emu_pid" 2>/dev/null; then
    echo 'ANDROID_TV_EMULATOR_EARLY_EXIT'
  fi
  # Disposable emulator only: no user credentials, provider URLs, or Stremio account.
  echo 'ANDROID_TV_EMULATOR_STARTUP_DIAGNOSTICS_BEGIN'
  adb devices -l | sed -n '1,5p' || true
  grep -iE 'error|warn|panic|failed|kvm|accel|fatal|virtualization|system image|avd' /tmp/enhanced-tv-emulator.stdout | tail -30 || true
  echo 'ANDROID_TV_EMULATOR_STARTUP_DIAGNOSTICS_END'
  exit 2
fi
printf 'Android emulator booted: %s\n' "$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
adb install -r "$apk" >/dev/null
adb shell am start -n org.thiajay.stremioenhanced.tv/.EnhancedTvActivity >/dev/null
# Never interact with account forms or video titles. Only test native launcher,
# anonymous React boot and an uncomplicated DPAD navigation event.
adb shell input keyevent KEYCODE_DPAD_DOWN
if ! timeout 75 bash -c 'until adb logcat -d -s EnhancedTvSmoke:I "*:S" | grep -Fq ANONYMOUS_WEB_REACT_VISIBLE; do sleep 4; done'; then
  echo 'ANDROID_TV_EMULATOR_FAIL_WEB_REACT_NOT_VISIBLE'
  adb logcat -d -s AndroidRuntime:E EnhancedTvSmoke:I '*:S' | tail -25
  exit 1
fi
if ! adb shell dumpsys activity activities | grep -Fq 'org.thiajay.stremioenhanced.tv'; then
  echo 'ANDROID_TV_EMULATOR_FAIL_ACTIVITY_NOT_RESUMED'
  exit 1
fi
printf '%s\n' 'ANDROID_TV_ANONYMOUS_WEBVIEW_RENDER_PASS'
printf '%s\n' 'NO_ACCOUNT_NO_EXTERNAL_STREAM_NO_DEVICE_INSTALL_NO_PRODUCTION_WRITES'
