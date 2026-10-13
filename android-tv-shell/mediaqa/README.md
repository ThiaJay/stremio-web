# Original Android WebView media probe

This is a **separate disposable Android TV emulator test application**, not Stremio Enhanced. It is not a production replacement or downloadable APK.

It deliberately remains independent of the actual Android WebView host and the separate native Media3 draft. Its only purpose is to determine whether an Android API34 emulator can decode locally generated H.264 video frames and process locally generated AAC sound through a browser Web Audio compressor. This is a platform capability test, **not proof that Stremio itself plays or that the actual Night Audio adapter processes programme audio**.

The CI runner creates a short original colour pattern video with a synthetic sine wave using FFmpeg filter generators. The MP4 is neither checked into Git nor uploaded as an artefact, downloaded from a provider or installed on a user's device. This isolated QA app serves the sample from its own APK through WebViewAssetLoader and refuses external network resources and navigation. It uses no cookies, account data or JavaScript bridge. Playback requires a real emulated remote key gesture.

The test records only predetermined success and failure markers. A pass requires decoded video frame callbacks and advancing playback time, together with repeated measurements of decoded waveform energy before and after a real DynamicsCompressorNode. It does not prove physical speaker output, programme compatibility or dialogue intelligibility.

If the emulator does not support decoded frame callbacks or Web Audio playback output, the corresponding test must fail explicitly. Do not replace an actual failure with a mock or infer successful playback from a successful build.

Source guard is in tests/audit.py. Runner is in tests/run_emulator.sh. The Enhanced WebView Android source remains unchanged. Do not merge, sign, release, pair a device, install on a physical television, authenticate with a Stremio account or alter watched progress on the strength of this result. Foundation PR68 remains the release authority.
