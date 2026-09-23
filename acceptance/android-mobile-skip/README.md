# Android mobile skip runtime acceptance

This project is a source bound native Android acceptance harness for the shared Stremio skip presentation contract tracked by Foundation issue 9.

It does not claim to be the private official Stremio Android application. It proves that the accepted Core contract can be rendered and exercised in a genuine Android mobile runtime without changing its semantics.

The workflow binds the harness to Core development commit `e12b41173b0aca767794fb6854f535817ad07654` and checks the corresponding `SKIP_SEGMENTS.md` contract before the Android emulator starts.

The native activity and instrumentation tests cover intro, recap and credits as one contextual action contract, Ask, Always and Never modes, once per playback generation consumption, live and unseekable fail closed behaviour, Next Video priority and the invariant that Skip Credits remains a seek in the current media rather than a next episode action.

Passing this gate satisfies representative native Android mobile presentation runtime acceptance only. It does not establish official Android mobile adoption, Android TV adoption, real TV display mode behaviour, codec acceptance or physical A V synchronisation.
