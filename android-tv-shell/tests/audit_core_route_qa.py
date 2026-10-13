#!/usr/bin/env python3
"""Enforce test-only Core route QA source and immutable accepted dependencies."""
from pathlib import Path
import json
import subprocess

root=Path(__file__).resolve().parents[2]
tv=root/'android-tv-shell'
code=(tv/'tests/real_core_route_qa.js').read_text(encoding='utf-8')
deps=json.loads((root/'package.json').read_text())['dependencies']
assert deps['@stremio/stremio-video']==(
    'github:ThiaJay/stremio-video#30af605c40229a84bed7b45f7c29908b32881f66')
assert deps['@stremio/stremio-core-web']==(
    'file:vendor/core-web/stremio-stremio-core-web-0.65.0.tgz')
for required in ("window.core", "core.getState('ctx')",
                 "ctx.profile.auth!==null", "core.encodeStream(",
                 "core.decodeStream(", "location.hash='#/player/'",
                 "requestVideoFrameCallback", "qa-local.mp4",
                 "credentials:'omit'", 'focusRealPlayControl'):
    assert required in code, required
for forbidden in ('core.dispatch(', 'window.localStorage',
                  'window.sessionStorage', 'addJavascriptInterface(',
                  'XMLHttpRequest', 'navigator.sendBeacon',
                  'https://stream', 'https://api.',
                  'setMediaPlaybackRequiresUserGesture(false)'):
    assert forbidden not in code, forbidden
source=tv/'app/src/debug/assets/web/qa-core-route.js'
assert source.is_file() and source.read_bytes()==code.encode('utf-8')
assert not (tv/'app/src/main/assets/web/qa-core-route.js').exists()
for name in ('qa-local.mp4','qa-core-route.js'):
    relative=f'android-tv-shell/app/src/debug/assets/web/{name}'
    p=subprocess.run(['git','ls-files','--error-unmatch',relative],
                     cwd=root,capture_output=True,text=True)
    assert p.returncode != 0, f'Test-only asset mistakenly committed: {relative}'
print('HOSTQA_CORE_ANONYMOUS_PLAYER_ROUTE_SOURCE_BOUNDARY_PASS')
