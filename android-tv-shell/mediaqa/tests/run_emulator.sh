#!/usr/bin/env bash
# Original H264/AAC WebView decoding test on disposable Android TV.
set -euo pipefail
apk="android-tv-shell/mediaqa/app/build/outputs/apk/debug/app-debug.apk"
test -s "$apk"
command -v sdkmanager >/dev/null
command -v avdmanager >/dev/null
command -v adb >/dev/null
[[ -r /dev/kvm && -w /dev/kvm ]] || {
  echo "MEDIAQA_BLOCKED_NO_KVM_PERMISSION"; exit 2;
}
sdkmanager --install emulator >/dev/null
emulator_bin="$ANDROID_HOME/emulator/emulator"
test -x "$emulator_bin"
"$emulator_bin" -accel-check
available="$(sdkmanager --list |
  grep -Eo 'system-images;android-(30|31|32|33|34|35);android-tv;(x86|x86_64)' |
  sort -Vu || true)"
[[ -n "$available" ]] || { echo "MEDIAQA_BLOCKED_NO_ANDROID_TV_IMAGE"; exit 2; }
chosen="$(printf '%s\n' "$available" | tail -1)"
sdkmanager --install "$chosen" >/dev/null
if avdmanager list device -c | grep -Fxq 'tv_1080p'; then
  tv="tv_1080p"
elif avdmanager list device -c | grep -Fxq 'tv_720p'; then
  tv="tv_720p"
else
  echo "MEDIAQA_BLOCKED_NO_TV_PROFILE"; exit 2
fi
avd_root="$HOME/.android/avd"
mkdir -p "$avd_root"
avd_dir="$avd_root/isolated_mediaqa.avd"
if ! printf 'no\n' | avdmanager create avd -n isolated_mediaqa -k "$chosen" \
   -d "$tv" -p "$avd_dir" --force >/tmp/isolated-mediaqa-avd.log 2>&1; then
  echo "MEDIAQA_BLOCKED_AVD_CREATION"; exit 2
fi
# A known Android SDK CLI version omits the disposable AVD index.
if [[ -s "$avd_dir/config.ini" && ! -e "$avd_root/isolated_mediaqa.ini" ]]; then
  expr='^system-images;android-([0-9]+);android-tv;(x86|x86_64)$'
  if [[ "$chosen" =~ $expr ]]; then
    api="$(printf '%s' "$chosen" | cut -d';' -f2 | cut -d'-' -f2)"
    abi="$(printf '%s' "$chosen" | cut -d';' -f4)"
    img="$ANDROID_HOME/system-images/android-$api/android-tv/$abi/system.img"
    if [[ -s "$img" ]]; then
      printf 'avd.ini.encoding=UTF-8\npath=%s\npath.rel=avd/isolated_mediaqa.avd\ntarget=android-%s\n' \
         "$avd_dir" "$api" >"$avd_root/isolated_mediaqa.ini"
      echo "MEDIAQA_EPHEMERAL_AVD_INDEX_REPAIRED"
    fi
  fi
fi
if [[ ! -s "$avd_root/isolated_mediaqa.ini" || ! -s "$avd_dir/config.ini" ]] ||
   ! "$emulator_bin" -list-avds | grep -Fxq isolated_mediaqa; then
  echo "MEDIAQA_BLOCKED_AVD_NOT_REGISTERED"; exit 2
fi
# Host audio stays enabled. A virtual sink still cannot prove audible quality.
"$emulator_bin" -avd isolated_mediaqa -no-window -no-boot-anim \
 -gpu swiftshader_indirect -no-snapshot -accel on -wipe-data \
 >/tmp/isolated-mediaqa-emulator.log 2>&1 &
emulator_pid=$!
cleanup() {
  adb emu kill >/dev/null 2>&1 || true
  kill "$emulator_pid" >/dev/null 2>&1 || true
  wait "$emulator_pid" >/dev/null 2>&1 || true
  rm -f android-tv-shell/mediaqa/app/src/main/assets/sample.mp4
}
trap cleanup EXIT
if ! timeout 240 bash -c 'until
  adb devices | grep -q "emulator-[0-9]*[[:space:]]*device" &&
  [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\''\r'\'')" == 1 ]]
do sleep 3; done'; then
  echo "MEDIAQA_BLOCKED_BOOT_TIMEOUT"
  adb devices -l | sed -n '1,5p' || true
  exit 2
fi
sdk="$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
echo "MEDIAQA_EMULATOR_BOOTED_API_${sdk}"
[[ "$sdk" == "34" ]] || { echo "MEDIAQA_WRONG_API"; exit 2; }
adb logcat -c || true
adb install -r "$apk" >/dev/null
adb shell am start -W -n \
  org.thiajay.stremioenhanced.mediaqa/.MediaQaActivity >/tmp/isolated-mediaqa-launch.log
if ! timeout 60 bash -c 'until adb logcat -d -s MediaFixtureQA:I "*:S" |
    grep -Fq MEDIAQA_READY_FOR_USER_GESTURE; do sleep 2; done'; then
  echo "MEDIAQA_FAIL_ORIGINAL_VIDEO_METADATA_NOT_READY"
  adb logcat -d -s MediaFixtureQA:I '*:S' | tail -15 || true
  exit 1
fi
# A real remote key activation, never autoplay or arbitrary JS evaluation.
for attempt in 1 2; do
  adb shell input keyevent KEYCODE_DPAD_CENTER
  sleep 2
  if adb logcat -d -s MediaFixtureQA:I '*:S' |
      grep -Fq MEDIAQA_GESTURE_ACCEPTED; then break; fi
done
if ! adb logcat -d -s MediaFixtureQA:I '*:S' |
    grep -Fq MEDIAQA_GESTURE_ACCEPTED; then
  echo "MEDIAQA_FAIL_REAL_REMOTE_GESTURE_NOT_RECEIVED"
  exit 1
fi
echo "MEDIAQA_USER_GESTURE_PASS"
# Both conditions are required. Never infer a decode from a successful APK.
if ! timeout 35 bash -c 'until
  data="$(adb logcat -d -s MediaFixtureQA:I "*:S")"
  [[ "$data" == *MEDIAQA_VIDEO_DECODED_FRAMES_AND_TIME_PASS* ]] &&
  [[ "$data" == *MEDIAQA_DECODED_AUDIO_PCM_COMPRESSION_PASS* ]]
do sleep 2; done'; then
  if adb logcat -d -s MediaFixtureQA:I '*:S' |
      grep -Fq MEDIAQA_VIDEO_DECODED_FRAMES_AND_TIME_PASS; then
    echo "MEDIAQA_VIDEO_DECODE_PASS"
  else
    echo "MEDIAQA_FAIL_NO_DECODED_VIDEO_FRAME_PROOF"
  fi
  if adb logcat -d -s MediaFixtureQA:I '*:S' |
      grep -Fq MEDIAQA_DECODED_AUDIO_PCM_COMPRESSION_PASS; then
    echo "MEDIAQA_WEB_AUDIO_PCM_PASS"
  else
    echo "MEDIAQA_FAIL_NO_WEB_AUDIO_PCM_PROOF"
  fi
  # Only fixed outcome names from the native allowlist.
  adb logcat -d -s MediaFixtureQA:I '*:S' | tail -25 || true
  exit 1
fi
if adb logcat -d -s MediaFixtureQA:I '*:S' |
   grep -Fq MEDIAQA_EXTERNAL_REQUEST_BLOCKED; then
  echo "MEDIAQA_FAIL_EXTERNAL_REQUEST_ATTEMPTED"; exit 1
fi
echo "MEDIAQA_ANDROID_WEBVIEW_H264_AAC_AND_COMPRESSOR_PASS"
echo "MEDIAQA_NO_STREMIO_ACCOUNT_NO_EXTERNAL_STREAM_NO_PHYSICAL_DEVICE"
