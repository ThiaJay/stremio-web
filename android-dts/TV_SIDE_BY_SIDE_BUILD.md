# Android TV side by side DTS fix build

22 September 2026

## Result

Public workflow run 35731518240 completed successfully.

The workflow downloaded the exact official Stremio Android TV 1.10.4 ARM APK, verified its SHA 256, decoded it with pinned Apktool 3.0.3, changed the package identity for side by side installation and changed one branch inside NextLib buildAudioRenderers so the FFmpeg audio renderer is preferred. The video renderer method was verified to retain its original ordering.

The rebuilt APK was zipaligned, signed with a one off test key, verified with apksigner and checked to expose package com.stremio.dtsfix.

## Checksums

Official source APK

e18a5405bb53e12a903ff477457318b8f8d3c8e1995e0a4c3ff5d8893d1ccf0b

Patched APK

0585530065c710686b045aca342afad9be40351ba8239723492fd44a7a0b484d

Workflow artifact ID

10696065633

Workflow artifact digest

sha256:8862a800fc515f52dc1f7331a84c075cce92b2a455983ce03ac1031300e9a77e

## Safety

The patched package is com.stremio.dtsfix. It does not replace com.stremio.one.

The Windows installation kit verifies the patched APK checksum, uses ADB install only, never uninstalls official Stremio and never clears official app data.

## Acceptance boundary

Automated build acceptance is complete. Physical device acceptance remains the final runtime check because no authorised device transport is available in this session. The side by side design makes that check reversible without altering the official Stremio installation.
