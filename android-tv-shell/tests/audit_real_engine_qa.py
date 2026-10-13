#!/usr/bin/env python3
"""Exact player source and test-only asset boundaries. Not a release audit."""
from pathlib import Path
import json
import subprocess

root=Path(__file__).resolve().parents[2]
tv=root/'android-tv-shell'
deps=json.loads((root/'package.json').read_text())['dependencies']
assert deps['@stremio/stremio-video']==(
    'github:ThiaJay/stremio-video#30af605c40229a84bed7b45f7c29908b32881f66')
source=(tv/'tests/real_stremio_backend_qa.js').read_text()
config=(tv/'tests/video_qa.webpack.config.cjs').read_text()
assert "require('@stremio/stremio-video')" in source
for required in ['implementationChanged',"commandName:'load'",
                 "commandName:'setNightAudio'",'requestVideoFrameCallback',
                 'qa-local.mp4',"credentials:'omit'","when:'off'"]:
    assert required in source,required
for forbidden in ['localStorage','sessionStorage','stremio-core-web',
                  'addJavascriptInterface','XMLHttpRequest','navigator.sendBeacon',
                  'watchProgress','Core.dispatch','accountLogin']:
    assert forbidden not in source,forbidden
assert '../app/src/debug/assets/web' in config
assert 'devtool:false' in config and 'clean:false' in config
compiled=tv/'app/src/debug/assets/web/qa-video-engine.js'
assert compiled.is_file() and 10000<compiled.stat().st_size<30_000_000
assert not (tv/'app/src/main/assets/web/qa-video-engine.js').exists()
for basename in ['qa-video-engine.js','qa-local.mp4']:
    rel=f'android-tv-shell/app/src/debug/assets/web/{basename}'
    p=subprocess.run(['git','ls-files','--error-unmatch',rel],
                     cwd=root,text=True,capture_output=True)
    assert p.returncode!=0,'Committed synthetic test asset: '+rel
print('HOSTQA_EXACT_STREMIO_VIDEO_TEST_ONLY_SOURCE_GATE_PASS')
