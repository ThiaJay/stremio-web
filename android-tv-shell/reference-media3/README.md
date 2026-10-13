# Experimental Media3 audio reference only

This directory preserves the original Java reference objects from Web PR43 commit `9982ceb5173cd1d1688c0f5064100757952e3b56` **without any changes to their source bytes**. The three class names, package declarations and original Git blob identities are listed in `provenance.json`.

It is deliberately outside `app/src/main/java`. The production candidate is an Android WebView host for the Enhanced Web build, not a native Media3 player. Compiling this proof-only processor inside the WebView app without a Media3 dependency caused the source/PR integration builds to fail and would incorrectly couple two independent audio architectures.

The reference is **not included in the WebView APK** and is **not a working native playback integration**. Its Media3 API integration and compatibility require a separate isolated module, pinned dependency, version-appropriate tests and actual PCM path and audible playback evidence before anyone can consider native use. Retaining these source files is not authorisation to add Media3 to the WebView host.

The existing Android WebView tests, licence, account, security and hardware release gates remain unchanged. No signing, APK upload, installation, stream/account access or production write is permitted by these source changes.
