# Playback backend integration

22 September 2026

## Development route

Changes to the shared video dependency are carried as a version locked pnpm patch in this existing Web fork. No upstream repository permission, new repository or local computer control is needed. The original dependency integrity remains in the lockfile. pnpm generates the patch metadata and the resulting installation must pass the frozen lockfile check.

The preparation workflow can write only to this isolated candidate branch through its normal repository token. It refuses to push when the branch has changed since checkout. It does not deploy, merge, change repository permissions or update the integration branch.

## Implemented native lifecycle hardening

The patch modifies the actual ShellVideo source from video package 0.0.98. Pending native loads are invalidated by a newer load, unload or destruction. Stream observations reflect the real selected source and clear on unload. Seeking and cache buffering remain independent reasons to suppress recovery. Late native events cannot revive a destroyed player.

Tests execute that installed source with a simulated MPV transport. They are adapter behaviour tests, not physical playback acceptance and not audio codec decode tests. No unimplemented recovery or timing capability is advertised.

## Android DTS path

Stremio maintains a public Media3 library fork. Its FfmpegLibrary maps DTS and DTS HD to the dca decoder and supportsFormat checks that the decoder really exists in the native build.

The proposed Android recovery should retain the normal hardware video renderer while selecting an FFmpeg audio renderer to produce compatible PCM after a verified audio failure. This does not require mixing ExoPlayer video with a separate VLC playback clock. It must preserve track intent, position and user audio settings and must not silently disable working passthrough on other routes.

An audio renderer reporting activity does not prove a television or receiver is emitting sound. Missing observations are unknown rather than healthy. Normal silent scenes, mute, pauses, buffering and seeking must not trigger a false repair.

The official Android TV application integration and a signed build are still required. A pnpm dependency patch changes only clients that consume that dependency. This work does not update an installed Android TV application and does not claim that the DTS incident has been fixed on a television.

## Sources and lineage

ThiaJay/stremio-development-foundation issue 17 retains the acceptance boundary.

ThiaJay/stremio-web PR 10 remains the combined integration authority and is not modified by this candidate.

https://github.com/Stremio/media/blob/stremio/libraries/decoder_ffmpeg/src/main/java/androidx/media3/decoder/ffmpeg/FfmpegLibrary.java

https://developer.android.com/media/media3/exoplayer/supported-formats

https://pnpm.io/cli/patch

https://pnpm.io/cli/patch-commit
