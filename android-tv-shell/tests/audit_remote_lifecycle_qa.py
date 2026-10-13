#!/usr/bin/env python3
"""Verify test-only Android remote lifecycle acceptance remains isolated."""
from pathlib import Path

root = Path(__file__).resolve().parents[2]
tv = root / "android-tv-shell"
test = (tv / "app/src/androidTest/java/org/thiajay/stremioenhanced/tv"
        / "EnhancedTvRemoteLifecycleInstrumentedTest.java").read_text(encoding="utf-8")
runner = (tv / "tests/host_media_emulator.sh").read_text(encoding="utf-8")
workflow = (root / ".github/workflows/enhanced-tv-webview-validation.yml").read_text(
    encoding="utf-8"
)

assert test.count("@Test(") == 2, "Expected both remote lifecycle tests"
for required in (
    "KEYCODE_DPAD_CENTER", "KEYCODE_BACK", "R.string.reload",
    "R.string.go_home", "R.string.exit", "sendKeyDownUpSync",
    "window.core.getState('ctx')", "auth===null",
    "https://appassets.androidplatform.net",
    "__nativeQaDocumentToken===undefined",
    "REMOTE_RELOAD_MOUNTED", "REMOTE_HOME_MOUNTED",
    "REMOTE_HOME_ANONYMOUS", "REMOTE_EXIT_CONFIRMED",
    "BACK_SAFE_INTERNAL_NAVIGATION", "BACK_EXIT_CONFIRMED",
):
    assert required in test, "Missing native remote acceptance gate " + required

for forbidden in (
    ".performClick(", ".click(", "addJavascriptInterface",
    "setWebContentsDebuggingEnabled(true)", "getSharedPreferences(",
    "core.transport.dispatch(", "AccountLogin", "watchProgress",
    "https://api.strem.io", "installPackage(", "adb shell",
):
    assert forbidden not in test, "Unreviewed action in native remote QA " + forbidden

assert "EnhancedTvRemoteLifecycleInstrumentedTest" in runner
assert r"OK \(5 tests\)" in runner
assert "timeout 365 adb shell am instrument -w" in runner
assert "HOSTQA_NATIVE_REMOTE_NAVIGATION_LIFECYCLE_PASS" in runner
assert "HOSTQA_EMULATOR_TEARDOWN_COMPLETE" in runner
assert "feature/enhanced-tv-remote-lifecycle-qa-20261013-v1" in workflow
assert "pnpm install --frozen-lockfile --ignore-scripts" in workflow
assert "pnpm audit --prod --audit-level moderate" in workflow
assert "Release status HELD" in workflow
assert "Deliberately no artifact uploads" in workflow

print("HOSTQA_NATIVE_REMOTE_ANONYMOUS_SOURCE_AND_PRIVACY_PASS")
