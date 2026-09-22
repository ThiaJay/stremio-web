# Android TV DTS audio recovery

## Purpose

Stremio Android TV 1.10.4 already contains NextLib FFmpeg audio decoding and a native DCA decoder. The shipped NextLib generation predates runtime decoder switching, so ExoPlayer cannot move only failing DTS audio from passthrough to FFmpeg PCM.

This candidate backports NextLib DecoderManager onto the Media3 1.10 compatible release line and adds an audio only DTS recovery controller.

## Behaviour

Normal non DTS audio is unchanged.

DTS, DTS HD, DTS Express and DTS X use FFmpeg PCM unless the exact passthrough route is already known to be good.

A known good route remains on automatic passthrough until a relevant decoder or AudioTrack failure occurs.

The controller disables tunnelling through DefaultTrackSelector before forcing FFmpeg audio, then restores the configured tunnelling state when returning to automatic audio selection.

Video decoder selection is never changed by the DTS controller.

## Integration point

Create one DecoderManager before CustomRenderersFactory.

Call setDecoderManager on the renderers factory before building ExoPlayer.

After building the player, attach the manager on the player application thread.

Create DtsAudioRecoveryController with the DecoderManager and the same DefaultTrackSelector already used by Stremio.

Feed current Tracks into onTracksChanged and feed PlaybackException into onPlayerError before Stremio's existing whole player fallback.

If audio only recovery handles the failure, do not switch the whole player to VLC. If recovery declines or later fails, retain the existing fallback chain.

## Immutable validation inputs

NextLib Media3 1.10 base commit

6ff6cf9d0820382b3c233d018c52e4163b09d345

Runtime switching source commit

2dc77cd2d9352bc308aa26782f9c77a320df510b

The original Stremio Android TV 1.10.4 ARM APK inspected during diagnosis had SHA 256

e18a5405bb53e12a903ff477457318b8f8d3c8e1995e0a4c3ff5d8893d1ccf0b
