#!/usr/bin/env python3
"""Fail-closed source/APK preflight for a separate, still unreleased Fire TV lab."""
from pathlib import Path
import json
import re
import sys
import zipfile

root = Path(__file__).resolve().parents[2]
tv = root / "android-tv-shell"
gradle = (tv / "app/build.gradle").read_text(encoding="utf-8")
manifest = (tv / "app/src/main/AndroidManifest.xml").read_text(encoding="utf-8")
source = (tv / "app/src/main/java/org/thiajay/stremioenhanced/tv/"
          "EnhancedTvActivity.java").read_text(encoding="utf-8")
runner = (tv / "tests/host_media_emulator.sh").read_text(encoding="utf-8")
workflow = (root / ".github/workflows/"
            "enhanced-tv-webview-validation.yml").read_text(encoding="utf-8")

expected_package = "org.thiajay.stremioenhanced.tv"
assert re.search(r"applicationId\s+'" + re.escape(expected_package) + r"'", gradle)
assert "minSdk 26" in gradle and "targetSdk 35" in gradle
assert "compileSdk 36" in gradle
assert "org.thiajay.stremioenhanced.tv" in source
assert "com.stremio.one" not in gradle + manifest + source
assert 'android:allowBackup="false"' in manifest
assert 'android:usesCleartextTraffic="false"' in manifest
assert 'android.software.leanback' in manifest
assert 'android.permission.INTERNET' in manifest
assert 'android.permission.REQUEST_INSTALL_PACKAGES' not in manifest
assert 'android.permission.READ_EXTERNAL_STORAGE' not in manifest
assert "setWebContentsDebuggingEnabled(false)" in source
assert "setAcceptThirdPartyCookies(webView, false)" in source
assert "addJavascriptInterface(" not in source
assert "HOSTQA_TARGET_API:-34" in runner
assert "30|34)" in runner
assert '[[ "$sdk" == "$target_api" ]]' in runner
assert "HOSTQA_TARGET_API_" in runner
assert "HOSTQA_CLEAN_FIXTURE" in runner
assert "source-and-apk:" in workflow
assert "pnpm install --frozen-lockfile --ignore-scripts" in workflow
assert "pnpm audit --prod --audit-level moderate" in workflow
assert "Release status HELD" in workflow
assert "Deliberately no artifact uploads" in workflow
assert "actions/upload-artifact" not in workflow
assert "adb -s 192." not in workflow + runner
assert "adb pair" not in workflow + runner
assert "HOSTQA_BLOCKED_TARGET_ANDROID_TV_IMAGE_UNAVAILABLE" in runner

if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
    print("AFTKRT_API30_SOURCE_RELEASE_HOLD_GATE_PASS")
    raise SystemExit(0)
if len(sys.argv) != 2:
    raise SystemExit("AFTKRT_API30_EXPECTS_BUILT_APK")

apk = Path(sys.argv[1])
assert apk.is_file() and apk.stat().st_size > 200_000
with zipfile.ZipFile(apk) as archive:
    members = set(archive.namelist())
    assert "assets/web/index.html" in members
    assert "assets/web-source-integrity.json" in members
    record = json.loads(archive.read("assets/web-source-integrity.json"))
    assert record["releaseEligible"] is False
    assert record["stremioAccountTested"] is False
    assert record["tvDeviceTested"] is False
    assert len(record["exactSourceSha"]) == 40
    assert not any(m.startswith("assets/web/qa-") for m in members), (
        "Debug media or QA scripts must not enter release assets")
    assert not any(m.endswith(".map") for m in members)
    native = [m for m in members if m.startswith("lib/") and m.endswith(".so")]
    abis = {m.split("/")[1] for m in native}
    if native:
        assert "armeabi-v7a" in abis, (
            "AFTKRT uses armeabi-v7a: package has incompatible native libraries")
    assert not any(m.startswith("META-INF/") and m.endswith(".RSA")
                   and "STREMIO" in m for m in members)
    assert not any(m.startswith("assets/web/") and "private-key" in m.lower()
                   for m in members)

print("AFTKRT_API30_APK_ARCHITECTURE_AND_RELEASE_HOLD_PASS",
      "JAVA_ONLY" if not native else "ARMV7_NATIVE_PRESENT",
      len(members), apk.stat().st_size)
