# Selective Android TV DTS side-by-side RC build receipt

Date: 23 September 2026

Branch head used for build:

730a725e6b6ec6d8d3b2c131fe2a88c7afb355c5

Workflow run:

35804991564

Result:

success

Artifact:

- ID: 10727981156
- name: stremio-dts-selective-rc-arm
- artifact digest: sha256:3995789adaaecd604e886ca70f70fab46dde7e315e65a5cd51def088e6b200b0

APK:

- file: Stremio-DTS-Selective-RC-arm.apk
- package: com.stremio.dtsrc
- SHA-256: 7b949aae75d70f82401b6b30e4aa782716c68d57d2f3ae3bcde6abd308a6d8a6
- architecture: armeabi-v7a / ARM Fire TV path
- source APK: official Stremio Android TV 1.10.4 ARM
- source APK SHA-256: e18a5405bb53e12a903ff477457318b8f8d3c8e1995e0a4c3ff5d8893d1ccf0b

Build gates passed:

1. selective controller compiled against the Media3 1.10-compatible NextLib source;
2. controller-only dex was produced;
3. exact official APK hash was verified before patching;
4. side-by-side identity patch was applied;
5. APK was rebuilt successfully;
6. controller dex was injected as classes10.dex;
7. APK was aligned, signed and verified;
8. package name was verified as com.stremio.dtsrc;
9. final APK contains classes10.dex.

Additional static verification after artifact download confirmed:

- classes10.dex contains SelectiveDtsAudioController;
- classes10.dex references FfmpegAudioRenderer, setRendererDisabled and setTunnelingEnabled;
- the main application dex set references SelectiveDtsAudioController, confirming the player factory attachment was compiled into the rebuilt APK.

Behaviour of this side-by-side RC:

- non-DTS audio retains the shipped automatic renderer order;
- a selected DTS-family audio track disables non-FFmpeg audio renderers;
- tunnelling is disabled only while the DTS fallback is forced and restored after leaving DTS;
- video renderers are not modified.

Boundary:

This is an engineering side-by-side candidate, not an official Stremio release. It uses an ephemeral test signing key and cannot replace or update com.stremio.one. The production design remains the validated DecoderManager/DtsAudioRecoveryController integration in development.
