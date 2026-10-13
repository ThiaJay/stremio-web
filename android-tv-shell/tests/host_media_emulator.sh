#!/usr/bin/env bash
# Actual Enhanced Android TV host original-media instrumentation on disposable emulator.
set -euo pipefail
apk="android-tv-shell/app/build/outputs/apk/debug/app-debug.apk"
test_apk="android-tv-shell/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"
test -s "$test_apk"
test -s "$apk"
command -v sdkmanager >/dev/null
command -v avdmanager >/dev/null
command -v adb >/dev/null
[[ -r /dev/kvm && -w /dev/kvm ]] || {
  echo "HOSTQA_BLOCKED_NO_KVM_PERMISSION"; exit 2;
}
sdkmanager --install emulator >/dev/null
emulator_bin="$ANDROID_HOME/emulator/emulator"
test -x "$emulator_bin"
"$emulator_bin" -accel-check
available="$(sdkmanager --list |
  grep -Eo 'system-images;android-(30|31|32|33|34|35);android-tv;(x86|x86_64)' |
  sort -Vu || true)"
[[ -n "$available" ]] || { echo "HOSTQA_BLOCKED_NO_ANDROID_TV_IMAGE"; exit 2; }
chosen="$(printf '%s\n' "$available" | tail -1)"
sdkmanager --install "$chosen" >/dev/null
if avdmanager list device -c | grep -Fxq 'tv_1080p'; then
  tv="tv_1080p"
elif avdmanager list device -c | grep -Fxq 'tv_720p'; then
  tv="tv_720p"
else
  echo "HOSTQA_BLOCKED_NO_TV_PROFILE"; exit 2
fi
avd_root="$HOME/.android/avd"
mkdir -p "$avd_root"
avd_dir="$avd_root/enhanced_hostqa.avd"
if ! printf 'no\n' | avdmanager create avd -n enhanced_hostqa -k "$chosen" \
   -d "$tv" -p "$avd_dir" --force >/tmp/enhanced-hostqa-avd.log 2>&1; then
  echo "HOSTQA_BLOCKED_AVD_CREATION"; exit 2
fi
# A known Android SDK CLI version omits the disposable AVD index.
if [[ -s "$avd_dir/config.ini" && ! -e "$avd_root/enhanced_hostqa.ini" ]]; then
  expr='^system-images;android-([0-9]+);android-tv;(x86|x86_64)$'
  if [[ "$chosen" =~ $expr ]]; then
    api="$(printf '%s' "$chosen" | cut -d';' -f2 | cut -d'-' -f2)"
    abi="$(printf '%s' "$chosen" | cut -d';' -f4)"
    img="$ANDROID_HOME/system-images/android-$api/android-tv/$abi/system.img"
    if [[ -s "$img" ]]; then
      printf 'avd.ini.encoding=UTF-8\npath=%s\npath.rel=avd/enhanced_hostqa.avd\ntarget=android-%s\n' \
         "$avd_dir" "$api" >"$avd_root/enhanced_hostqa.ini"
      echo "HOSTQA_EPHEMERAL_AVD_INDEX_REPAIRED"
    fi
  fi
fi
if [[ ! -s "$avd_root/enhanced_hostqa.ini" || ! -s "$avd_dir/config.ini" ]] ||
   ! "$emulator_bin" -list-avds | grep -Fxq enhanced_hostqa; then
  echo "HOSTQA_BLOCKED_AVD_NOT_REGISTERED"; exit 2
fi
# Host audio stays enabled. A virtual sink still cannot prove audible quality.
"$emulator_bin" -avd enhanced_hostqa -no-window -no-boot-anim \
 -gpu swiftshader_indirect -no-snapshot -accel on -wipe-data \
 >/tmp/enhanced-hostqa-emulator.log 2>&1 &
emulator_pid=$!
# The previous run proved decoded video and compressed PCM, then hung in
# Android emulator shutdown until GitHub cancelled the job. Keep teardown
# strictly bounded and do not report acceptance before it has completed.
cleanup() {
  local prior_status=$?
  trap - EXIT
  timeout --kill-after=2s 8s adb emu kill >/dev/null 2>&1 || true
  if kill -0 "$emulator_pid" 2>/dev/null; then
    kill -TERM "$emulator_pid" >/dev/null 2>&1 || true
    for attempt in 1 2 3 4 5; do
      if ! kill -0 "$emulator_pid" 2>/dev/null; then break; fi
      sleep 1
    done
    if kill -0 "$emulator_pid" 2>/dev/null; then
      kill -KILL "$emulator_pid" >/dev/null 2>&1 || true
    fi
  fi
  wait "$emulator_pid" >/dev/null 2>&1 || true
  rm -f /tmp/enhanced-hostqa-instrumentation-private.txt
  rm -f android-tv-shell/app/src/debug/assets/web/qa-local.mp4
  if kill -0 "$emulator_pid" 2>/dev/null; then
    echo "HOSTQA_FAIL_EMULATOR_TEARDOWN"
    return 1
  fi
  echo "HOSTQA_EMULATOR_TEARDOWN_COMPLETE"
  return "$prior_status"
}
trap cleanup EXIT
if ! timeout 240 bash -c 'until
  adb devices | grep -q "emulator-[0-9]*[[:space:]]*device" &&
  [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\''\r'\'')" == 1 ]]
do sleep 3; done'; then
  echo "HOSTQA_BLOCKED_BOOT_TIMEOUT"
  adb devices -l | sed -n '1,5p' || true
  exit 2
fi
sdk="$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
echo "HOSTQA_EMULATOR_BOOTED_API_${sdk}"
[[ "$sdk" == "34" ]] || { echo "HOSTQA_WRONG_API"; exit 2; }
adb logcat -c || true
# The real application APK and its separate test-only instrumentation APK
# are installed ONLY on the disposable Android emulator.
adb install -r "$apk" >/dev/null
adb install -r "$test_apk" >/dev/null
result_file='/tmp/enhanced-hostqa-instrumentation-private.txt'
rm -f "$result_file"
if ! timeout 365 adb shell am instrument -w \
  -e class org.thiajay.stremioenhanced.tv.EnhancedHostMediaInstrumentedTest,org.thiajay.stremioenhanced.tv.EnhancedEngineInstrumentedTest,org.thiajay.stremioenhanced.tv.EnhancedCoreRouteInstrumentedTest \
  org.thiajay.stremioenhanced.tv.test/androidx.test.runner.AndroidJUnitRunner \
  >"$result_file" 2>&1; then
  echo 'HOSTQA_FAIL_INSTRUMENTATION_RUNTIME'
  exit 1
fi
if ! grep -Eq 'OK \(3 tests\)' "$result_file" || \
   grep -Eq 'FAILURES!!!|INSTRUMENTATION_FAILED|shortMsg=Process crashed' "$result_file"; then
  # Read only fixed test names, expected test counts and allowlisted synthetic
  # failure labels. NEVER echo raw UI hierarchy, URL, stack or worker state.
  python3 android-tv-shell/tests/diagnose_core_route.py "$result_file"
  echo 'HOSTQA_FAIL_ONE_OR_MORE_INSTRUMENTATION_ACCEPTANCE_TESTS'
  exit 1
fi
# A passing test is not a passing workflow until the emulator has exited.
cleanup
echo 'HOSTQA_ACTUAL_ENHANCED_HOST_H264_AAC_AND_PCM_PASS'
echo 'HOSTQA_ORIGINAL_EMULATOR_FIXTURE_NO_ACCOUNT_NO_DEVICE_NO_RELEASE'
