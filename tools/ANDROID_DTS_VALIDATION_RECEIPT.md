# Android DTS recovery validation receipt

22 September 2026

## Authoritative recovery source

The recovery source validated by the full public Android build is commit

66f0bed70c855af0c7f0352c76898909026c756f

The current Android DTS branch head is

b87b84f2878a29da461c60ff0234a32987e1d772

A commit comparison confirms that no files under android-dts/src or android-dts/test changed between those commits. Later changes are limited to workflows, the local rebuild script and redundancy documentation.

## Full public Android validation

Workflow run

35712270886

Result

success

The run backported NextLib runtime decoder switching onto immutable Media3 1.10 base commit 6ff6cf9d0820382b3c233d018c52e4163b09d345, applied the DTS variant mapping and compiled and tested the Stremio recovery candidate in the real NextLib media3ext module.

The run also assembled the release AAR and produced the checkpoint artefact.

Artefact ID

10687630310

Artefact name

android-dts-recovery-checkpoint

Artefact digest

sha256:6937934e57bf05b76d788f3f87715f3f0d17211b62199f925120f04450be88cb

The checkpoint contains the validated NextLib AAR, recovery manifest and Windows deployment kit. The build recipe remains reproducible from immutable commits after the hosted artefact expires.

## Windows deployment kit validation

Workflow run

35712879644

Result

success

The Windows gate parsed the PowerShell installer, proved a missing APK fails closed before device mutation and checked that the deployment script contains no destructive uninstall or app data clearing command.

## Independent routes

Public GitHub Actions can reproduce the Android checkpoint.

tools/Build-AndroidDtsCheckpoint.ps1 can reproduce the same checkpoint locally from immutable source commits without Commander or hosted CI.

android-dts/deploy/Run-Deploy.cmd performs direct ADB deployment and never uninstalls the official Stremio package.

.github/workflows/android-dts-self-hosted.yml permits the same device deployment through an optional self hosted Windows runner.

The shipped Stremio Android TV 1.10.4 application also contains a real MPV player path and exposes MPV in its internal player menu alongside ExoPlayer and libVLC. MPV is therefore retained as a whole player fallback when audio only Exo recovery is unavailable.

## Remaining external boundary

The recovery candidate cannot replace the installed official Android TV application until it is integrated into an Android application build signed compatibly with the installed Stremio package. The deployment tooling deliberately does not bypass Android signature security.


## Fast compile gate

Workflow run

35713049586

Result

success

This gate reapplies the immutable NextLib backport and compiles the Stremio DTS recovery Kotlin sources without rebuilding native FFmpeg. It exists to catch integration mistakes quickly while the full native build remains the authoritative end to end library validation.
