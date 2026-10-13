#!/usr/bin/env python3
"""Scope check for disposable actual-player subtitle QA, NOT release approval."""
from pathlib import Path
import json
import subprocess
import sys

root=Path(__file__).resolve().parents[2]
tv=root/'android-tv-shell'
source=(tv/'tests/subtitle_runtime_qa.js').read_text(encoding='utf-8')
webpack=(tv/'tests/video_qa.webpack.config.cjs').read_text(encoding='utf-8')
dependencies=json.loads((root/'package.json').read_text())['dependencies']
assert dependencies['@stremio/stremio-video']==(
    'github:ThiaJay/stremio-video#30af605c40229a84bed7b45f7c29908b32881f66')
assert dependencies['@stremio/stremio-core-web']==(
    'file:vendor/core-web/stremio-stremio-core-web-0.65.0.tgz')
for required in ("require('@stremio/stremio-video')",
                 "require('../../src/routes/Player/enhancedSubtitlePolicy.js')",
                 'new StremioVideo()', 'policy.decide(', 'manualSubtitlePreference:true',
                 'requestVideoFrameCallback', "qa-local.mp4",
                 "credentials:'omit'", "selectedExtraSubtitlesTrackId",
                 'container.textContent', 'trackLoaded', 'restoredOff',
                 'ORIGINAL_QA_ENGLISH_SUBTITLE'):
    assert required in source,required
for forbidden in ('window.core', 'window.localStorage', 'window.sessionStorage',
                  'addJavascriptInterface(', 'XMLHttpRequest', 'navigator.sendBeacon',
                  'https://stream', 'https://api.', 'document.cookie',
                  'setMediaPlaybackRequiresUserGesture(false)', 'fetch("http'):
    assert forbidden not in source,forbidden
assert 'devtool: false' in webpack
assert 'qa-subtitles' in webpack and 'qa-video-engine' in webpack
compiled=tv/'app/src/debug/assets/web/qa-subtitles.js'
assert compiled.is_file() and 10_000<compiled.stat().st_size<30_000_000
assert not (tv/'app/src/main/assets/web/qa-subtitles.js').exists()
for basename in ('qa-local.mp4','qa-subtitles.js','qa-video-engine.js'):
    name=f'android-tv-shell/app/src/debug/assets/web/{basename}'
    p=subprocess.run(['git','ls-files','--error-unmatch',name],cwd=root,
                     text=True,capture_output=True)
    assert p.returncode!=0, 'Debug media accidentally committed: '+name
print('HOSTQA_ENHANCED_SUBTITLE_POLICY_VIDEO_BACKEND_TEST_ONLY_PASS')
