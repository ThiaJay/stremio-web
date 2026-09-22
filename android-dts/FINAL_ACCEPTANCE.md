# Android TV DTS final acceptance

Date: 22 September 2026

## Device evidence

A Fire TV acceptance build proved the original regression can be resolved while retaining ExoPlayer video:

- DTS-HD MA 5.1 produced working audio.
- ExoPlayer video remained smooth.
- The original VLC-like video stutter did not occur.
- Internal frame-versus-playback-clock measurements were stable rather than progressively drifting.
- The first dedicated capture showed a median internal offset of about 66 ms with essentially no drift.
- The final multi-phase acceptance showed the same class of small stable offset through steady playback, pause/resume and seeks.
- The non-DTS control source also played through the scripted control interval with a similar small stable internal offset.

The diagnostic probe was corrected after an early test version accessed ExoPlayer from the playback thread. The accepted diagnostic posts player reads to the Android main thread.

## Final implementation rule

Do not ship the side-by-side proof patch that globally preferred FFmpeg audio.

The production candidate is codec selective:

1. DTS, DTS-HD, DTS Express and DTS:X may use FFmpeg PCM when the exact passthrough route is not known good or after a relevant decoder/AudioTrack failure.
2. AAC, AC3, E-AC3 and other non-DTS audio remain on automatic decoder selection.
3. Leaving a DTS stream restores automatic audio selection exactly once.
4. Video decoder selection is never changed by the DTS recovery controller.
5. Repeated track notifications are idempotent and must not thrash decoder selection.
6. A normal renderer lead in the observed roughly 50-65 ms range is not treated as progressive drift and must not trigger continuous correction by itself.

## Late control-source error

After the scripted control capture had finished, the user observed a later Exo source failure on an AC3 source: IllegalStateException / "No valid variant mask found".

The AC3 source had already played normally for the scripted control interval. The failure was not captured in the bounded acceptance log, so it is not evidence of AC3 decoder failure. Treat it as a separate source-transition/lifecycle error and do not route AC3 through DTS recovery.

The exact error string is not present in this repository or in the public source searched during this investigation. A future Android application integration should preserve the existing whole-player/source fallback for unhandled source-selection failures rather than misclassifying them as DTS audio failures.

## User-side testing boundary

This acceptance is sufficient for the DTS audio-only recovery design. Further progress should use deterministic CI, integration tests and application-source integration rather than requiring repeated Fire TV diagnostic runs from the user.
