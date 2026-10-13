#!/usr/bin/env python3
"""Require real pinned StremioVideo DSP and bounded test-only graph probes."""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
tv = root / 'android-tv-shell'
deps = json.loads((root / 'package.json').read_text())['dependencies']
exact = 'github:ThiaJay/stremio-video#30af605c40229a84bed7b45f7c29908b32881f66'
assert deps['@stremio/stremio-video'] == exact
src = (tv / 'tests/measured_stremio_night_audio_qa.js').read_text()
config = (tv / 'tests/video_measured_qa.webpack.config.cjs').read_text()
test = (tv / 'app/src/androidTest/java/org/thiajay/stremioenhanced/tv/'
        'EnhancedMeasuredNightAudioInstrumentedTest.java').read_text()
for marker in (
    "require('@stremio/stremio-video')",
    'createMediaElementSource',
    'createDynamicsCompressor',
    "destination === instrumented.compressor",
    'realSourceConnect(tap)',
    'realCompressorConnect(tap)',
    'tap.connect(destination)',
    'instrumented.before.getFloatTimeDomainData(input)',
    'instrumented.after.getFloatTimeDomainData(output)',
    'after < before * 0.78',
    'goodWindows >= 5',
    "event.isTrusted",
    "commandName:'setNightAudio'",
    "when:'always'",
    "when:'off'",
    'requestVideoFrameCallback',
    "credentials:'omit'",
):
    assert marker in src, marker
for forbidden in (
    'localStorage', 'sessionStorage', 'stremio-core-web',
    'addJavascriptInterface', 'XMLHttpRequest', 'navigator.sendBeacon',
    'watchProgress', 'Core.dispatch', 'accountLogin',
    'window.fetch =', 'window.WebSocket =',
):
    assert forbidden not in src, forbidden
for marker in (
    "qa-video-engine-measured.js", "devtool: false", "clean: false",
    "../app/src/debug/assets/web"
):
    assert marker in config, marker
for marker in (
    "EnhancedTvActivity.class", "KEYCODE_DPAD_CENTER",
    "__enhancedMeasuredNightQa?.complete===true",
    '__enhancedMeasuredNightQa?.error===false',
):
    assert marker in test, marker

bundle = tv / 'app/src/debug/assets/web/qa-video-engine-measured.js'
assert bundle.is_file() and 10000 < bundle.stat().st_size < 30_000_000
prod = tv / 'app/src/main/assets/web'
assert not (prod / 'qa-video-engine-measured.js').exists()
assert not (prod / 'qa-night-loud.mp4').exists()
for asset in ('qa-video-engine-measured.js', 'qa-night-loud.mp4'):
    relative = f'android-tv-shell/app/src/debug/assets/web/{asset}'
    result = subprocess.run(['git', 'ls-files', '--error-unmatch', relative],
                            cwd=root, text=True, capture_output=True)
    assert result.returncode != 0, f'Forbidden committed QA asset {relative}'
print('HOSTQA_EXACT_REAL_STREMIO_NIGHT_AUDIO_DSP_MEASUREMENT_SOURCE_GATE_PASS')
