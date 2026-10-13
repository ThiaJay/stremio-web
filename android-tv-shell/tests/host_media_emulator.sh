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
  rm -f /tmp/enhanced-subtitleqa-stage-private.txt
  rm -f android-tv-shell/app/src/debug/assets/web/qa-local.mp4
  if kill -0 "$emulator_pid" 2>/dev/null; then
    echo "HOSTQA_FAIL_EMULATOR_TEARDOWN"
    return 1
  fi
  echo "HOSTQA_EMULATOR_TEARDOWN_COMPLETE"
  return "$prior_status"
}
trap cleanup EXIT
# Do not treat 'unauthorized' or 'offline' as a booted Android device.
# These states occurred in source-bound hosted run 38385372659. ADB server
# reconnection uses the original host credentials; never replace/plant keys,
# alter Android's authorisation policy, or interact with any personal device.
boot_started=$SECONDS
unauthorized_since=-1
host_reconnected=false
serial=''
boot_complete=false
while (( SECONDS - boot_started < 240 )); do
  devices="$(timeout --kill-after=2s 8s adb devices -l 2>/dev/null || true)"
  adb_state="$(printf '%s\n' "$devices" |
    python3 android-tv-shell/tests/classify_emulator_adb.py --classify)"
  case "$adb_state" in
    multiple|foreign)
      echo 'HOSTQA_BLOCKED_UNEXPECTED_ADB_DEVICE'
      exit 2
      ;;
    unauthorized)
      if (( unauthorized_since < 0 )); then
        unauthorized_since=$SECONDS
        echo 'HOSTQA_ADB_TRANSPORT_UNAUTHORIZED_OBSERVED'
      fi
      if [[ "$(printenv GITHUB_ACTIONS 2>/dev/null || true)" == true && "$host_reconnected" == false ]] &&
         (( SECONDS - unauthorized_since >= 30 )); then
        # Only the disposable isolated hosted emulator. An ordinary host
        # service reconnect is not an authorisation bypass and may fail.
        timeout --kill-after=2s 8s adb kill-server >/dev/null 2>&1 || true
        timeout --kill-after=2s 8s adb start-server >/dev/null 2>&1 || true
        host_reconnected=true
        echo 'HOSTQA_ADB_HOST_RECONNECT_ONCE'
      fi
      if (( SECONDS - unauthorized_since >= 105 )); then
        echo 'HOSTQA_BLOCKED_ADB_UNAUTHORIZED'
        exit 2
      fi
      ;;
    device)
      serial="$(printf '%s\n' "$devices" |
        grep -E '^emulator-[0-9]{4,6}[[:space:]]+device([[:space:]]|$)' |
        awk 'NR==1 {print $1}' || true)"
      if [[ ! "$serial" =~ ^emulator-[0-9]{4,6}$ ]]; then
        echo 'HOSTQA_BLOCKED_UNRECOGNISED_EMULATOR_SERIAL'
        exit 2
      fi
      completed="$(timeout --kill-after=2s 8s adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null |
        tr -d '\r' || true)"
      if [[ "$completed" == 1 ]]; then
        boot_complete=true
        break
      fi
      ;;
    offline|absent|unknown)
      ;;
    *)
      echo 'HOSTQA_BLOCKED_ADB_CLASSIFIER_UNEXPECTED'
      exit 2
      ;;
  esac
  if ! kill -0 "$emulator_pid" 2>/dev/null; then
    echo 'HOSTQA_BLOCKED_EMULATOR_PROCESS_EXITED'
    exit 2
  fi
  sleep 3
done
if [[ "$boot_complete" != true ]]; then
  echo 'HOSTQA_BLOCKED_BOOT_TIMEOUT'
  exit 2
fi
sdk="$(timeout --kill-after=2s 8s adb -s "$serial" shell getprop ro.build.version.sdk 2>/dev/null |
  tr -d '\r' || true)"
echo "HOSTQA_EMULATOR_BOOTED_API_$sdk"
[[ "$sdk" == "34" ]] || { echo "HOSTQA_WRONG_API"; exit 2; }
adb -s "$serial" logcat -c || true
# The real application APK and its separate test-only instrumentation APK
# are installed ONLY on the disposable Android emulator.
adb -s "$serial" install -r "$apk" >/dev/null
adb -s "$serial" install -r "$test_apk" >/dev/null
result_file='/tmp/enhanced-hostqa-instrumentation-private.txt'
rm -f "$result_file"
# AndroidJUnitRunner -w may omit per-test STATUS entries. Diagnose its JUnit
# summary and fixed custom QA stages without printing raw Android logs.
report_subtitle_failure() {
  python3 android-tv-shell/tests/report_subtitle_qa.py "$result_file" ||
    echo 'HOSTQA_TEST_RESULT_PARSER_UNAVAILABLE'
  local stage_file='/tmp/enhanced-subtitleqa-stage-private.txt'
  rm -f "$stage_file"
  if timeout 10s adb -s "$serial" logcat -d -s EnhancedSubtitleQA:I '*:S' > "$stage_file" 2>/dev/null; then
    python3 android-tv-shell/tests/report_subtitle_qa.py --stages "$stage_file" ||
      echo 'HOSTQA_SUBTITLE_STAGE_PARSER_UNAVAILABLE'
  else
    echo 'HOSTQA_SUBTITLE_STAGE_CAPTURE_UNAVAILABLE'
  fi
  rm -f "$stage_file"
}
if ! timeout 330 adb -s "$serial" shell am instrument -w \
  -e class org.thiajay.stremioenhanced.tv.EnhancedHostMediaInstrumentedTest,org.thiajay.stremioenhanced.tv.EnhancedEngineInstrumentedTest,org.thiajay.stremioenhanced.tv.EnhancedSubtitleInstrumentedTest \
  org.thiajay.stremioenhanced.tv.test/androidx.test.runner.AndroidJUnitRunner \
  >"$result_file" 2>&1; then
  report_subtitle_failure
  echo 'HOSTQA_FAIL_INSTRUMENTATION_RUNTIME'
  exit 1
fi
if ! grep -Eq 'OK \(3 tests\)' "$result_file" || \
   grep -Eq 'FAILURES!!!|INSTRUMENTATION_FAILED|shortMsg=Process crashed' "$result_file"; then
  report_subtitle_failure
  echo 'HOSTQA_FAIL_MEDIA_DECODE_OR_PCM_NOT_ACCEPTED'
  exit 1
fi
# A passing test is not a passing workflow until the emulator has exited.
cleanup
echo 'HOSTQA_ACTUAL_ENHANCED_HOST_H264_AAC_AND_PCM_PASS'
echo 'HOSTQA_ORIGINAL_SUBTITLE_POLICY_BACKEND_RENDER_PASS'
echo 'HOSTQA_ORIGINAL_EMULATOR_FIXTURE_NO_ACCOUNT_NO_DEVICE_NO_RELEASE'
