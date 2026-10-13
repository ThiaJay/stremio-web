# Amazon AFTKRT Android 11 private lab qualification

This is a separate, non-release extension of [accepted PR50](https://github.com/ThiaJay/stremio-web/pull/50), source `7481c9dc4226aad81f87dca5b1d86980287aa5c2`. Do not merge, deploy, automatically install, upload an APK or alter the original source acceptance. Private Foundation PR68 remains the release authority.

## User authorisation and actual TV

On 13 October 2026 the user **conditionally authorised a side-by-side Enhanced test app installation after all qualification, privacy, account, signing and rollback gates pass**, provided official Stremio and their existing account/viewing history remain untouched.

The user directly proved by targeted, read-only ADB commands:

- Amazon Fire TV **AFTKRT**, authorised ADB target, Android **11**, API **30**, CPU ABI **armeabi-v7a**
- Enabled valid provider `com.amazon.webview.chromium`, Amazon Chromium 148
- Official `com.stremio.one` **1.11.2** installed
- Separate package `org.thiajay.stremioenhanced.tv` **not installed** at the recorded snapshot
- An additional distinct unauthorised ADB transport is present and must **never** be an implicit default target

These results are physical system readback, not a successful physical Enhanced playback/remote or installation test. Preserve historical failed ADB scans and the successful user's targeted ADB proof; do not ask to repeat normal ADB setup.

## New exact-source tests

The QA runner now accepts only `HOSTQA_TARGET_API=34` or `30`, demands an exact available Android TV image, verifies the actual guest API and **all five** earlier real-host, original-media and D-pad instrumentation tests, and cleans up the emulator. The workflow first requires the previously accepted Android 34 suite, then the additional Android **30** suite, rather than replacing or skipping an accepted test.

The source/APK audit checks the independent application ID, Android minimum SDK 26, TV/Leanback packaging, original privacy and permissions, presence of the genuine Web bundle, exactly pinned Core/Video source, a non-released build receipt and absence of x86-only packaged JNI libraries on the user's ARMv7 device. The manual Windows read-only device preflight verifies exactly the authorised Amazon AFTKRT, unchanged official version, Android API/ABI and the still-absent lab package without opening Stremio.

A stock API30 emulator uses a different WebView build from the actual **Amazon Chromium 148**, so a passing CI result is a **necessary, not sufficient**, physical device qualification. Missing API30 image or failing runtime gates must fail closed.

## Remaining gates before any APK reaches the television

1. Exact source-bound Android30 and Android34 CI **completed/success**, preserved security advisory, Web regression and package integrity results.
2. **Licence/source notice and dependency redistribution review**, including exact Core archive and third-party licences, without bypassing the separate blocked Media3 PR46 mandatory trust audit. The Media3 branch is not included in this WebView candidate.
3. Build from that accepted exact source, verify signed APK SHA256, debug/test-only signing identity and official-package isolation, and deliver privately through a reviewed route. There is **no downloadable APK** from the accepted PR50 workflow and this qualification branch also deliberately uploads none.
4. Read-only physical preflight returns `AFTKRT_READ_ONLY_HARDWARE_PRESERVATION_PASS`, with a unique validated AFTKRT. The second unauthorised device is ignored.
5. Before installation, record actual original `com.stremio.one` package/version and the absence of the separate lab package. Create and review a one-use rollback that targets **only** `org.thiajay.stremioenhanced.tv`, refuses if package identity is unexpected and never uninstalls or modifies official Stremio.
6. Only after separate local installer/source and rollback acceptance, install the isolated QA package with **no credentials, no login, no real provider playback, no watched-state mutation and no background app switching**. Do not claim permanent usability from a successful install.
7. Observe the real Fire TV screen, D-pad, WebView rendering and later original synthetic H264/AAC only if the asset and playback test are approved. Get human or accepted capture evidence for actual speaker output. Never infer heard audio from metadata.

Install approval is conditional and **not a waiver** of software policy holds, account-state protection, user foreground consent for launch, app permissions or licensing.

## Allowed rollback boundary

The APK must have application ID exactly `org.thiajay.stremioenhanced.tv`, distinct from `com.stremio.one`. A qualified rollback may uninstall **only** the separate test package. The original Stremio client must retain the same version and remain launchable; no steps may clear its data. Never execute `pm clear com.stremio.one`, `adb uninstall com.stremio.one`, overwrite an existing Stremio APK, change device-wide settings, use an unauthorised ADB target, extract account storage, or replay watched history to repair uncertain positions.

Private delivery and any generated downloads belong under `A:\Downloads`, not the Windows user profile Downloads folder. The historical AFTKRT IP address is not source authority; use fresh readback and the exact authorised target at execution time.

## Current status

**SOURCE QUALIFICATION CANDIDATE ONLY. NO APK AVAILABLE FOR INSTALL, NO PRIVATE BINARY UPLOADED, NO DEVICE INSTALLATION OR ACCOUNT ACCESS.** Separate native Media3 draft PR46 remains security held. Subtitle PR49 is independent and not represented as accepted within this new branch.
