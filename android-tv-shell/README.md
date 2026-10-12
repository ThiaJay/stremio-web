# Stremio Enhanced TV Web host, isolated development candidate

This is an **unofficial, separately packaged Android TV host for the actual Enhanced Web build**. It is not the previous synthetic Media3 companion, not a Stremio release, and not yet a verified client for the owner's Fire TV.

Source authority: existing Web [PR 42](https://github.com/ThiaJay/stremio-web/pull/42), itself stacked on Web Night Audio PR 41; the private Foundation [PR 68](https://github.com/ThiaJay/stremio-development-foundation/pull/68) governs publication, acceptance and safety.

## What it adds

- A dedicated Leanback launcher package, `org.thiajay.stremioenhanced.tv`, separate from official `com.stremio.one` and earlier synthetic companion `org.thiajay.stremiotvcompanion`.
- A real Android WebView displaying the **exact compiled Enhanced Web product** with Core-Web WASM/Worker, in a sandboxed secure `WebViewAssetLoader` origin. Web code is copied from the pinned source build, **not fetched dynamically or updated silently**.
- Remote-focusable native Back, Home, Reload and Exit controls, retained Web React UI and the Enhanced Web subtitle, skip and Night Audio source features.
- A deliberate Internet permission for actual network-backed Stremio Web operation. Native Android host has **no account-write API, credentials, downloads, analytics, cleartext traffic, external intents, boot receiver, background service, exported provider or extra storage permission**.
- No third-party cookies, no arbitrary top-level remote navigations, strict local path validation, no JavaScript bridge, no WebView debugging or automatic external players.

## Build

Stage source at `android-tv-shell/` inside the reviewed `ThiaJay/stremio-web` branch. First build the **complete Web product** using the unchanged frozen dependency, tests, lint, webpack build, moderate audit and source pin checks. Copy its `build/` directory into `android-tv-shell/app/src/main/assets/web/` with source maps removed and a privacy/security static scan. Build with JDK 17+, Gradle 8.11.1, Android Gradle Plugin 8.9.2 and SDK 36:

`gradle -p android-tv-shell :app:testDebugUnitTest :app:lintDebug :app:assembleDebug --no-daemon`

No downloadable APK, user installation, signing/release, production account use or system setting change is authorised by a passing hosted build.

## Critical incomplete work

- The real Web app uses its own Core Web Worker. **Its authenticated Stremio backend/account, addon handling and actual video playback have not been tested in Android WebView.** Merely rendering a WebView and loading assets does not demonstrate that playback or Stremio progress synchronisation works.
- Local virtual HTTPS origin `appassets.androidplatform.net` and strict mixed-content denial may reject local HTTP streaming-server URLs. That is intentional for this initial security constrained build. Provider compatibility needs separate independent testing without weakening global WebView security.
- DRM codecs, Android WebView build version, D-pad navigation of Web content, subtitle tracks, audio output, TV refresh rate, Night Audio backend, background behaviour and actual Fire TV hardware are unverified.
- Third-party sign-in redirects are blocked by default. A permission-minimised, explicitly reviewed authentication flow is required before a dedicated test account can be used. Do not use the owner's normal account for initial experimentation.
- GNU GPL v2 from the Web source must accompany any future distributed binary, with accurate provenance, corresponding source and notices. The app is clearly unaffiliated with Stremio. No public release without licence/privacy review and explicit owner approval.
- The original official Stremio installation, watched state and addon setup are protected. Do not install, replace or test production account writes to close a test gate.

## Release classification

**SOURCE_CANDIDATE_ONLY.** A green CI will establish a compiled Android TV Web host and source-only tests. It is not Fire TV acceptance, installed software or a fully functioning replacement. Do not merge or publish until independently proven.
