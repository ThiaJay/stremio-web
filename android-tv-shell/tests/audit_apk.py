#!/usr/bin/env python3
from pathlib import Path
import sys
import zipfile
import json
perms=Path(sys.argv[1]).read_text()
lines=[x for x in perms.splitlines() if 'uses-permission:' in x]
assert len(lines)==1 and "android.permission.INTERNET" in lines[0],lines
apk=Path(sys.argv[2]);assert apk.is_file() and apk.stat().st_size>200_000
with zipfile.ZipFile(apk) as z:
    names=set(z.namelist())
    assert 'assets/web/index.html' in names
    assert 'assets/web-source-integrity.json' in names
    payload=json.loads(z.read('assets/web-source-integrity.json'))
    assert payload['releaseEligible'] is False
    assert payload['stremioAccountTested'] is False
    assert payload['tvDeviceTested'] is False
    assert any(n.endswith('/scripts/main.js') and n.startswith('assets/web/') for n in names)
    assert any(n.endswith('/scripts/worker.js') and n.startswith('assets/web/') for n in names)
    assert not any(n.endswith('.map') for n in names)
print('ANDROID_TV_APK_STRUCTURE_AND_POLICY_PASS',len(names),apk.stat().st_size)
