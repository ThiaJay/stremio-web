from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: patch_selective_side_by_side.py <decoded-apk-dir>")

root = Path(sys.argv[1])
manifest = root / "AndroidManifest.xml"
text = manifest.read_text()

replacements = {
    'package="com.stremio.one"': 'package="com.stremio.dtsrc"',
    'com.stremio.one.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION': 'com.stremio.dtsrc.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
    'android:label="@string/app_name"': 'android:label="Stremio DTS Selective"',
    'android:authorities="com.stremio.one.content"': 'android:authorities="com.stremio.dtsrc.content"',
    'android:authorities="com.stremio.one.firebaseinitprovider"': 'android:authorities="com.stremio.dtsrc.firebaseinitprovider"',
    'android:authorities="com.stremio.one.androidx-startup"': 'android:authorities="com.stremio.dtsrc.androidx-startup"',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"manifest anchor missing: {old}")
    text = text.replace(old, new)
manifest.write_text(text)

companions = list(root.glob('smali*/com/stremio/common/players/ExoPlayer$Companion.smali'))
if len(companions) != 1:
    raise SystemExit(f"expected one ExoPlayer Companion, found {len(companions)}")

path = companions[0]
code = path.read_text()
method_anchor = '.method private final createPlayer('
start = code.find(method_anchor)
if start < 0:
    raise SystemExit('private createPlayer method not found')
end = code.find('.end method', start)
method = code[start:end]

anchor = '''    invoke-interface {v0, v9}, Landroidx/media3/exoplayer/ExoPlayer;->setVideoChangeFrameRateStrategy(I)V

    return-object v0'''
replacement = '''    invoke-interface {v0, v9}, Landroidx/media3/exoplayer/ExoPlayer;->setVideoChangeFrameRateStrategy(I)V

    invoke-interface {v0}, Landroidx/media3/exoplayer/ExoPlayer;->getTrackSelector()Landroidx/media3/exoplayer/trackselection/TrackSelector;
    move-result-object v1
    check-cast v1, Landroidx/media3/exoplayer/trackselection/DefaultTrackSelector;

    invoke-virtual {p3}, Lcom/stremio/core/types/profile/Profile$Settings;->getAudioPassthrough()Z
    move-result v2

    invoke-static {v0, v1, v2}, Lcom/stremio/common/players/SelectiveDtsAudioController;->attach(Landroidx/media3/exoplayer/ExoPlayer;Landroidx/media3/exoplayer/trackselection/DefaultTrackSelector;Z)V

    return-object v0'''

if method.count(anchor) != 1:
    raise SystemExit('selective controller injection anchor changed')

method = method.replace(anchor, replacement)
code = code[:start] + method + code[end:]
path.write_text(code)

print('patched side-by-side identity and selective DTS controller attachment')
