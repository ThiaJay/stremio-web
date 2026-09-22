# Android DTS redundancy routes

The Android DTS work must remain usable even when one automation provider is unavailable.

The primary build route is the public GitHub Actions workflow on the android/dts-audio-recovery branch. It produces a resumable checkpoint artefact containing the validated NextLib AAR, manifest and Windows deployment kit.

The first independent fallback is tools/Build-AndroidDtsCheckpoint.ps1. It rebuilds the same checkpoint locally from immutable NextLib commits. It requires Git, Java and an Android SDK and NDK suitable for the pinned NextLib build. It does not use ChatGPT tools or GitHub hosted Actions after the source clones complete.

The device deployment route is android-dts/deploy/Run-Deploy.cmd. It uses ADB directly and never uninstalls Stremio or clears app data.

An optional self hosted Windows GitHub runner can invoke the same deployment script through android-dts-self-hosted.yml. This does not consume GitHub hosted runner minutes.

All routes use the same RECOVERY_MANIFEST.json and preserve the rule that Android signature security is never bypassed.
