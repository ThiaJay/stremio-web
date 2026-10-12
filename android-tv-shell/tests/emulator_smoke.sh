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
# Create and verify an explicit, disposable AVD. Older avdmanager versions
# sometimes exit 0 after reporting a device-definition error but create no .ini.
avd_root="${HOME:?}/.android/avd"
mkdir -p "$avd_root"
avd_dir="$avd_root/enhanced_tv_qa.avd"
if ! printf 'no\n' | avdmanager create avd -n enhanced_tv_qa -k "$chosen" -d "$tv" \
  -p "$avd_dir" --force >/tmp/enhanced-tv-avd-create.log 2>&1; then
  echo 'ANDROID_TV_EMULATOR_BLOCKED_AVD_CREATION_FAILED'
  tail -25 /tmp/enhanced-tv-avd-create.log || true
  exit 2
fi
# Work around an SDK CLI version that creates config.ini but omits its AVD index.
# Reconstruct only this disposable, source-verified AVD if its image is present.
if [[ -s "$avd_dir/config.ini" && ! -e "$avd_root/enhanced_tv_qa.ini" ]]; then
  image_regex='^system-images;android-([0-9]+);android-tv;(x86|x86_64)$'
  if [[ "$chosen" =~ $image_regex ]]; then
    image_api="${BASH_REMATCH[1]}"
    image_abi="${BASH_REMATCH[2]}"
    image_dir="${ANDROID_HOME:?}/system-images/android-$image_api/android-tv/$image_abi"
    if [[ -s "$image_dir/system.img" ]]; then
      printf 'avd.ini.encoding=UTF-8\npath=%s\npath.rel=avd/enhanced_tv_qa.avd\ntarget=android-%s\n' \
        "$avd_dir" "$image_api" > "$avd_root/enhanced_tv_qa.ini"
      echo 'ANDROID_TV_EMULATOR_REPAIRED_EPHEMERAL_AVD_REGISTRATION'
    fi
  fi
fi
if [[ ! -s "$avd_root/enhanced_tv_qa.ini" || ! -s "$avd_dir/config.ini" ]] ||
  ! "$emulator_bin" -list-avds | grep -Fxq enhanced_tv_qa; then
  echo 'ANDROID_TV_EMULATOR_BLOCKED_AVD_NOT_REGISTERED'
  tail -25 /tmp/enhanced-tv-avd-create.log || true
  printf 'AVD_CONFIG_PRESENT=%s AVD_REGISTRATION_PRESENT=%s\n' \
    "$(test -s "$avd_dir/config.ini" && echo true || echo false)" \
    "$(test -s "$avd_root/enhanced_tv_qa.ini" && echo true || echo false)"
  exit 2
fi
echo 'ANDROID_TV_EMULATOR_AVD_REGISTERED'
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
# Confirm the native Back/Home/Reload/Exit toolbar is exposed to
# Android accessibility as labelled focusable buttons in this anonymous AVD.
# UIAutomator may report success without writing a file on Android TV. Fail
# closed unless an actual nonempty XML document is independently retrieved.
# All potential screen contents are ephemeral, never published or logged.
ui_capture='/tmp/enhanced-tv-toolbar-qa-private.xml'
rm -f "$ui_capture"
capture_ui() {
  local remote_path="$1"
  if adb exec-out cat "$remote_path" >"$ui_capture" 2>/dev/null &&
      test -s "$ui_capture"; then
    echo 'ANDROID_TV_NATIVE_TOOLBAR_XML_CAPTURED'
    return 0
  fi
  rm -f "$ui_capture"
  return 1
}
ui_captured=false
for attempt in 1 2 3; do
  # /data/local/tmp is writable by the shell user independently of external
  # storage mounting. Never guess a path from diagnostic command output.
  ui_dump='/data/local/tmp/enhanced-tv-toolbar-qa.xml'
  adb shell rm -f "$ui_dump" /sdcard/window_dump.xml \
      /sdcard/enhanced-tv-toolbar-qa.xml >/dev/null 2>&1 || true
  if timeout 40 adb shell uiautomator dump "$ui_dump" \
      >/tmp/enhanced-tv-uiautomator.log 2>&1 &&
      capture_ui "$ui_dump"; then
    ui_captured=true
    break
  fi
  # Some emulator images accept the command only with the system default
  # destination. Its content must still be read back and validated.
  if timeout 40 adb shell uiautomator dump \
      >/tmp/enhanced-tv-uiautomator-default.log 2>&1; then
    for ui_dump in /sdcard/window_dump.xml /data/local/tmp/window_dump.xml; do
      if capture_ui "$ui_dump"; then
        ui_captured=true
        break
      fi
    done
  fi
  if [[ "$ui_captured" == true ]]; then break; fi
  # --compressed is a genuine Android UIAutomator mode and can avoid
  # transient idle-state failures on animated TV surfaces. It must still
  # produce a real XML hierarchy that passes the independent node validator.
  ui_dump='/data/local/tmp/enhanced-tv-toolbar-qa.xml'
  if timeout 40 adb shell uiautomator dump --compressed "$ui_dump" \
      >/tmp/enhanced-tv-uiautomator-compressed.log 2>&1 &&
      capture_ui "$ui_dump"; then
    ui_captured=true
    break
  fi
  if grep -qi 'null root node' /tmp/enhanced-tv-uiautomator.log; then
    echo 'ANDROID_TV_NATIVE_TOOLBAR_UIAUTOMATOR_NULL_ROOT'
  elif grep -qi 'could not get idle state' /tmp/enhanced-tv-uiautomator.log; then
    echo 'ANDROID_TV_NATIVE_TOOLBAR_UIAUTOMATOR_NOT_IDLE'
  else
    echo 'ANDROID_TV_NATIVE_TOOLBAR_UIAUTOMATOR_XML_NOT_WRITTEN'
  fi
  sleep 3
done
if [[ "$ui_captured" != true ]]; then
  echo 'ANDROID_TV_NATIVE_TOOLBAR_XML_UNAVAILABLE_ON_EMULATOR'
  exit 1
fi
if ! python3 android-tv-shell/tests/check_tv_accessibility.py <"$ui_capture"; then
  rm -f "$ui_capture"
  echo 'ANDROID_TV_NATIVE_TOOLBAR_ACCESSIBILITY_FAILED'
  exit 1
fi
rm -f "$ui_capture"
printf '%s\n' 'ANDROID_TV_ANONYMOUS_WEBVIEW_RENDER_PASS'
printf '%s\n' 'NO_ACCOUNT_NO_EXTERNAL_STREAM_NO_DEVICE_INSTALL_NO_PRODUCTION_WRITES'
