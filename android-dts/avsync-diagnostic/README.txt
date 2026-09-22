Stremio AV Sync Diagnostic for Fire TV

1. Install Stremio-AV-Sync-Test-arm.apk beside the existing Stremio apps.
2. Open Stremio AV Sync Test.
3. Play the same DTS-HD MA 5.1 source that was smooth but marginally out of sync.
4. On the PC, run RUN_SYNC_TEST.cmd while playback continues.
5. Leave it running for the default three-minute capture.

The probe compares each sampled video frame presentation timestamp with ExoPlayer's active playback position and reports median offset, mean, range and change across the capture.

This measures internal player timing. It cannot measure extra physical latency introduced after Android by the TV panel, HDMI chain, soundbar, AVR or speakers.
