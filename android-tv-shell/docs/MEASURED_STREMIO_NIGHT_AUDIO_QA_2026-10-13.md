# Measured original-media Night Audio test in real Enhanced Android WebView

This is an independent source-only, **unmerged draft**, stacked on PR47 head `112e181dadb720a95104496ae317947e12f57ce8` and its exact pinned StremioVideo dependency `30af605c40229a84bed7b45f7c29908b32881f66`.

The earlier [PR47 source and emulator run 38366792022](https://github.com/ThiaJay/stremio-web/actions/runs/38366792022) passed two real-host instrumentation checks, including actual Stremio HTMLVideo backend selection and reported Night Audio active then Off. Those status reports alone did **not** measure the actual DSP signal.

## New independent measurement gate

The third test class uses the exact source-bound Stremio Video engine through a **separately compiled test-only Webpack bundle**. The original Enhanced Android activity, real bundled Web client and existing Core, Video and normal app policy source files remain unchanged.

An original, locally generated louder five-second H.264/AAC sine fixture is available only in the disposable runner's Android **debug** build. No original media is committed or included in the release source. Existing original-fixture acceptance remains unchanged.

A real remote D-pad click triggers the actual HTMLVideo player and its original guarded `setNightAudio` command. During test instrumentation only, two passive analyser nodes are inserted *in line* with the **actual Stremio Night Audio graph**, before the original compressor and after that compressor, whilst its original configured trim and destination remain in use. There is no additional audible output path. The test checks five separate PCM windows with nonzero input/output and an output root mean square below 78 per cent of the input, then verifies the actual engine reports Off when processing is disabled and that the video continues to present frames.

The measurement test must pass alongside both earlier tests, the original Core and Video pin checks, frozen dependencies, full Web source regressions, packaging policy, Android compilation, source privacy checks and bounded emulator teardown. A successful build or reported `active` alone **must never count as measured processing**.

## Still not accepted

This is original generated test media on a disposable Android emulator. It is not evidence that third-party add-ons produce eligible blob sources, that ordinary Stremio programme playback and subtitle/watched-state semantics work, or that Night Audio audibly improves dialogues on physical Fire TV speakers. The separate native Media3 PR46 remains blocked on its own mandatory source-trust audit. Physical hardware, account authentication, actual provider streams, signing, GPL compliance and release remain behind the Foundation PR68 gates.

No merge, published APK, personal device installation, private account or watched-state write is authorised by these checks.
