from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: patch_avsync_apk.py <decoded-dir>")

root = Path(sys.argv[1])
manifest = root / "AndroidManifest.xml"
text = manifest.read_text()

replacements = {
    'package="com.stremio.one"': 'package="com.stremio.avsync"',
    'com.stremio.one.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION': 'com.stremio.avsync.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
    'android:label="@string/app_name"': 'android:label="Stremio AV Sync Test"',
    'android:authorities="com.stremio.one.content"': 'android:authorities="com.stremio.avsync.content"',
    'android:authorities="com.stremio.one.firebaseinitprovider"': 'android:authorities="com.stremio.avsync.firebaseinitprovider"',
    'android:authorities="com.stremio.one.androidx-startup"': 'android:authorities="com.stremio.avsync.androidx-startup"',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"manifest anchor missing: {old}")
    text = text.replace(old, new)
manifest.write_text(text)

renderers = list(root.glob("smali*/io/github/anilbeesetti/nextlib/media3ext/ffdecoder/NextRenderersFactory.smali"))
if len(renderers) != 1:
    raise SystemExit(f"expected one NextRenderersFactory, found {len(renderers)}")

renderer_path = renderers[0]
code = renderer_path.read_text()
start = code.index(".method protected buildAudioRenderers")
end = code.index(".end method", start) + len(".end method")
method = code[start:end]
old_branch = "    if-ne p2, p3, :cond_1"
new_branch = "    if-ne p2, p2, :cond_1"
if method.count(old_branch) != 1:
    raise SystemExit("audio renderer preference anchor changed")
code = code[:start] + method.replace(old_branch, new_branch) + code[end:]
renderer_path.write_text(code)

companions = list(root.glob("smali*/com/stremio/common/players/ExoPlayer$Companion.smali"))
if len(companions) != 1:
    raise SystemExit(f"expected one ExoPlayer Companion, found {len(companions)}")

companion = companions[0]
companion_code = companion.read_text()
marker = ".method private final createPlayer("
start = companion_code.find(marker)
if start < 0:
    raise SystemExit("createPlayer method not found in Companion")
end = companion_code.find(".end method", start)
method = companion_code[start:end]

lines = method.splitlines()
patched = []
injected = 0
for line in lines:
    if line.startswith("    return-object "):
        reg = line.split()[-1]
        patched.extend([
            "",
            f"    invoke-static {{{reg}}}, Lcom/stremio/common/players/AvSyncProbe;->attach(Landroidx/media3/exoplayer/ExoPlayer;)Landroidx/media3/exoplayer/ExoPlayer;",
            f"    move-result-object {reg}",
            "",
        ])
        injected += 1
    patched.append(line)

if injected < 1:
    raise SystemExit("no createPlayer return path found for probe")

companion_code = companion_code[:start] + "\n".join(patched) + companion_code[end:]
companion.write_text(companion_code)

probe = companion.parent / "AvSyncProbe.smali"
probe.write_text(r'''.class public final Lcom/stremio/common/players/AvSyncProbe;
.super Ljava/lang/Object;
.source "AvSyncProbe.java"

.implements Landroidx/media3/exoplayer/video/VideoFrameMetadataListener;

.field private final player:Landroidx/media3/exoplayer/ExoPlayer;
.field private final handler:Landroid/os/Handler;
.field private count:I

.method public constructor <init>(Landroidx/media3/exoplayer/ExoPlayer;)V
    .locals 2
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lcom/stremio/common/players/AvSyncProbe;->player:Landroidx/media3/exoplayer/ExoPlayer;

    new-instance v0, Landroid/os/Handler;
    invoke-static {}, Landroid/os/Looper;->getMainLooper()Landroid/os/Looper;
    move-result-object v1
    invoke-direct {v0, v1}, Landroid/os/Handler;-><init>(Landroid/os/Looper;)V
    iput-object v0, p0, Lcom/stremio/common/players/AvSyncProbe;->handler:Landroid/os/Handler;

    const/4 v0, 0x0
    iput v0, p0, Lcom/stremio/common/players/AvSyncProbe;->count:I
    return-void
.end method

.method public static attach(Landroidx/media3/exoplayer/ExoPlayer;)Landroidx/media3/exoplayer/ExoPlayer;
    .locals 1
    new-instance v0, Lcom/stremio/common/players/AvSyncProbe;
    invoke-direct {v0, p0}, Lcom/stremio/common/players/AvSyncProbe;-><init>(Landroidx/media3/exoplayer/ExoPlayer;)V
    invoke-interface {p0, v0}, Landroidx/media3/exoplayer/ExoPlayer;->setVideoFrameMetadataListener(Landroidx/media3/exoplayer/video/VideoFrameMetadataListener;)V
    return-object p0
.end method

.method public onVideoFrameAboutToBeRendered(JJLandroidx/media3/common/Format;Landroid/media/MediaFormat;)V
    .locals 5
    iget v0, p0, Lcom/stremio/common/players/AvSyncProbe;->count:I
    add-int/lit8 v0, v0, 0x1
    iput v0, p0, Lcom/stremio/common/players/AvSyncProbe;->count:I
    rem-int/lit8 v0, v0, 0x1e
    if-nez v0, :done

    const-wide/16 v0, 0x3e8
    div-long v0, p1, v0

    new-instance v2, Lcom/stremio/common/players/AvSyncSample;
    iget-object v3, p0, Lcom/stremio/common/players/AvSyncProbe;->player:Landroidx/media3/exoplayer/ExoPlayer;
    invoke-direct {v2, v3, v0, v1}, Lcom/stremio/common/players/AvSyncSample;-><init>(Landroidx/media3/exoplayer/ExoPlayer;J)V

    iget-object v3, p0, Lcom/stremio/common/players/AvSyncProbe;->handler:Landroid/os/Handler;
    invoke-virtual {v3, v2}, Landroid/os/Handler;->post(Ljava/lang/Runnable;)Z
    pop

    :done
    return-void
.end method
''')

sample = companion.parent / "AvSyncSample.smali"
sample.write_text(r'''.class public final Lcom/stremio/common/players/AvSyncSample;
.super Ljava/lang/Object;
.source "AvSyncSample.java"

.implements Ljava/lang/Runnable;

.field private final player:Landroidx/media3/exoplayer/ExoPlayer;
.field private final framePtsMs:J

.method public constructor <init>(Landroidx/media3/exoplayer/ExoPlayer;J)V
    .locals 0
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lcom/stremio/common/players/AvSyncSample;->player:Landroidx/media3/exoplayer/ExoPlayer;
    iput-wide p2, p0, Lcom/stremio/common/players/AvSyncSample;->framePtsMs:J
    return-void
.end method

.method public run()V
    .locals 8
    iget-object v0, p0, Lcom/stremio/common/players/AvSyncSample;->player:Landroidx/media3/exoplayer/ExoPlayer;
    invoke-interface {v0}, Landroidx/media3/exoplayer/ExoPlayer;->getCurrentPosition()J
    move-result-wide v0

    iget-wide v2, p0, Lcom/stremio/common/players/AvSyncSample;->framePtsMs:J
    sub-long v4, v2, v0

    new-instance v6, Ljava/lang/StringBuilder;
    invoke-direct {v6}, Ljava/lang/StringBuilder;-><init>()V
    const-string v7, "positionMs="
    invoke-virtual {v6, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    invoke-virtual {v6, v0, v1}, Ljava/lang/StringBuilder;->append(J)Ljava/lang/StringBuilder;
    const-string v0, " framePtsMs="
    invoke-virtual {v6, v0}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    invoke-virtual {v6, v2, v3}, Ljava/lang/StringBuilder;->append(J)Ljava/lang/StringBuilder;
    const-string v0, " deltaMs="
    invoke-virtual {v6, v0}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    invoke-virtual {v6, v4, v5}, Ljava/lang/StringBuilder;->append(J)Ljava/lang/StringBuilder;
    invoke-virtual {v6}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
    move-result-object v0

    const-string v1, "STREMIO_AVSYNC"
    invoke-static {v1, v0}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I
    return-void
.end method
''')

print(f"patched {manifest}")
print(f"patched {renderer_path}")
print(f"patched {companion}")
print(f"created {probe}")
print(f"created {sample}")
