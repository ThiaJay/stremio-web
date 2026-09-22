STREMIO — FINAL USER-SIDE AV SYNC TEST

This is designed to be the last manual/device test required from you.

You need:
- Fire Stick on and ADB Debugging enabled.
- The corrected Stremio AV Sync Test app installed.
- The same DTS-HD MA 5.1 source already used for testing.
- One ordinary non-DTS source you know normally works (AAC, AC3 or EAC3 is ideal).

Run FINAL_ACCEPTANCE.cmd and follow the prompts.

The test captures:
- two-minute steady-state DTS timing;
- jitter, outliers and least-squares drift;
- automated pause/resume recovery;
- forward-seek recovery;
- backward-seek recovery;
- a normal non-DTS control source;
- decoder/renderer, MediaCodec and AudioTrack evidence;
- playback/thread errors and dropped-frame evidence;
- Fire TV model, OS/build, ABI, display configuration and app/package details;
- audio-route state before/during/after playback;
- raw Exo frame-vs-clock samples and full logcat.

At the end it creates one FINAL-AVSYNC-*.zip file. Send that ZIP back to ChatGPT.
