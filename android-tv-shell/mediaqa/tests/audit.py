#!/usr/bin/env python3
"""Safety and media identity checks for disposable, original test media only."""
from pathlib import Path
import json
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app/src/main/assets"
SOURCE = ROOT / "app/src/main/java/org/thiajay/stremioenhanced/mediaqa/MediaQaActivity.java"

def audit():
    manifest = ET.parse(ROOT / "app/src/main/AndroidManifest.xml").getroot()
    ns = "{http://schemas.android.com/apk/res/android}"
    permissions = [
        item.get(ns + "name") for item in manifest.findall("uses-permission")
    ]
    assert permissions == ["android.permission.INTERNET"]
    app = manifest.find("application")
    assert app is not None
    assert app.get(ns + "allowBackup") == "false"
    assert app.get(ns + "usesCleartextTraffic") == "false"
    components = [x for x in app if x.tag in {"activity","service","receiver","provider"}]
    assert len(components) == 1 and components[0].tag == "activity"
    assert components[0].get(ns + "name") == ".MediaQaActivity"

    java = SOURCE.read_text(encoding="utf-8")
    for required in (
        "WebViewAssetLoader", "setMediaPlaybackRequiresUserGesture(true)",
        "setAllowFileAccess(false)", "MIXED_CONTENT_NEVER_ALLOW",
        "setWebContentsDebuggingEnabled(false)",
        "MEDIAQA_EXTERNAL_REQUEST_BLOCKED", "MARKERS.contains(entry.message())"
    ):
        assert required in java, required
    for forbidden in ("addJavascriptInterface(", "Runtime.getRuntime().exec(",
                      "android.permission.READ_EXTERNAL_STORAGE", "setAllowFileAccess(true)"):
        assert forbidden not in java, forbidden
    html = (ASSETS / "index.html").read_text(encoding="utf-8")
    for required in (
        "fetch('./sample.mp4'", "URL.createObjectURL",
        "new URL(objectURL).origin !== location.origin",
        "requestVideoFrameCallback", "createMediaElementSource",
        "createDynamicsCompressor", "MEDIAQA_READY_FOR_USER_GESTURE",
        "MEDIAQA_DECODED_AUDIO_PCM_COMPRESSION_PASS",
        "MEDIAQA_VIDEO_DECODED_FRAMES_AND_TIME_PASS"
    ):
        assert required in html, required
    for forbidden in ("autoplay", "https://stream", "addJavascriptInterface",
                      "XMLHttpRequest", "navigator.sendBeacon"):
        assert forbidden not in html, forbidden

    fixture = ASSETS / "sample.mp4"
    assert fixture.is_file() and 15000 < fixture.stat().st_size < 4000000
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json",
         "-show_streams", "-show_format", str(fixture)],
        check=True, text=True, capture_output=True, timeout=15
    )
    data = json.loads(proc.stdout)
    tracks = {(s.get("codec_type"), s.get("codec_name")) for s in data["streams"]}
    assert ("video", "h264") in tracks, tracks
    assert ("audio", "aac") in tracks, tracks
    duration = float(data["format"]["duration"])
    assert 3 <= duration <= 8, duration
    print("MEDIAQA_ORIGINAL_H264_AAC_SOURCE_AND_PRIVACY_PASS")

if __name__ == "__main__":
    audit()
