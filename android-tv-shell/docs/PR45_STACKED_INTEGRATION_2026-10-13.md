# Stacked Android source acceptance, 13 October 2026

This note records the exact candidate pair for a **new pull request merge checkout validation**, not permission to merge or release either draft.

- Android WebView base draft [PR43](https://github.com/ThiaJay/stremio-web/pull/43), accepted source head `5d224073e51de28cae8a6196dc8f87a68a269512`.
- HTMLVideo Night Audio draft [PR45](https://github.com/ThiaJay/stremio-web/pull/45), independently accepted predecessor head `c05acdd4370b3ccfa4267604f2fcc78d16e9e613`. This documentation change creates a new PR45 head which must be validated separately.
- Video source `30af605c40229a84bed7b45f7c29908b32881f66`, as required by the exact tested Web manifest and frozen lockfile.
- Original vendor Core archive and its integrity checks must remain unchanged.

PR43's three experimental Media3 Java source objects are retained, unchanged, under `android-tv-shell/reference-media3/`, **outside the WebView app source set**. Their exact blob identities are in `reference-media3/provenance.json` and independently checked by the source unit tests. The WebView host must not gain a Media3 runtime dependency merely to satisfy compilation.

## Relevant executed evidence

- [PR43 source integration run 38339766592](https://github.com/ThiaJay/stremio-web/actions/runs/38339766592) and [run 38339762933](https://github.com/ThiaJay/stremio-web/actions/runs/38339762933) both passed after separating the unchanged reference from the real WebView host.
- [PR45 Android API34 integrated run 38338323683](https://github.com/ThiaJay/stremio-web/actions/runs/38338323683) passed source, APK, anonymous WebView React mount and actual UIAutomator native toolbar accessibility checks at the predecessor Night Audio head.
- [Video 38319331684](https://github.com/ThiaJay/stremio-video/actions/runs/38319331684), [Web dependency 38320657356](https://github.com/ThiaJay/stremio-web/actions/runs/38320657356) and [Chromium generated-audio processing 38320657360](https://github.com/ThiaJay/stremio-web/actions/runs/38320657360) passed with the corrected Video source.

## Gate to check for this update

GitHub's PR45 `pull_request` source-and-APK workflow must compile the PR45 candidate **against current PR43**, with exact source pins, unchanged Core archive, frozen dependencies, source isolation tests, Android compilation and APK audit. The independent PR45 `push` integrated workflow must also pass without altering the account, addon, secure origin, audio bypass or accessibility policies.

Passing these builds does not establish playback or sound quality for any genuine Stremio programme or third-party addon stream. Next, if the stacked code passes, use an isolated locally generated licensed or original media fixture without a Stremio account to establish WebView media and audio support, then separately evaluate dedicated test-account and Fire TV acceptance under the Foundation release authority. Production Stremio installation and account data remain untouched.

**Do not merge, upload or sign an APK, pair a device, authenticate, deploy, or change watched data without the existing explicit release approval.**
