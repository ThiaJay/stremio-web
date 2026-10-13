#!/usr/bin/env python3
"""Source gate independent of Gradle / APK inspection, not a full security audit."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET
base=Path(__file__).resolve().parents[1]
manifest=ET.parse(base/'app/src/main/AndroidManifest.xml').getroot()
ns='{http://schemas.android.com/apk/res/android}'
permissions=[e.attrib.get(ns+'name') for e in manifest.findall('uses-permission')]
assert permissions==['android.permission.INTERNET'],permissions
app=manifest.find('application');assert app is not None
assert app.attrib.get(ns+'allowBackup')=='false'
assert app.attrib.get(ns+'usesCleartextTraffic')=='false'
components=[x for x in list(app) if x.tag in {'activity','service','receiver','provider'}]
assert len(components)==1 and components[0].tag=='activity'
assert components[0].attrib.get(ns+'name')=='.EnhancedTvActivity'
activity=(base/'app/src/main/java/org/thiajay/stremioenhanced/tv/EnhancedTvActivity.java').read_text()
for required in ('WebViewAssetLoader', 'setAllowFileAccess(false)',
                 'setAllowUniversalAccessFromFileURLs(false)',
                 'MIXED_CONTENT_NEVER_ALLOW', 'setAcceptThirdPartyCookies(webView, false)',
                 'NavigationPolicy.isInternalNavigation', 'setWebContentsDebuggingEnabled(false)'):
    assert required in activity,required
for forbidden in ('addJavascriptInterface(', 'Runtime.getRuntime().exec(',
                  'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.REQUEST_INSTALL_PACKAGES'):
    assert forbidden not in activity,forbidden
assets=base/'app/src/main/assets'
receipt=json.loads((assets/'web-source-integrity.json').read_text())
assert receipt['schema']==1 and receipt['releaseEligible'] is False
assert receipt['assetCount']>=3 and len(receipt['exactSourceSha'])==40
assert (assets/'web/index.html').is_file()
print('ANDROID_TV_SOURCE_GATE_PASS',receipt['exactSourceSha'],receipt['assetCount'])
