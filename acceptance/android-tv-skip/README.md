# Android TV skip runtime acceptance

This isolated native Android TV harness validates the platform neutral Skip Intro, Skip Recap and Skip Credits interaction contract against the accepted Web and Core authorities.

It runs on an Android TV system image with a real D pad hardware profile. Instrumentation sends Android remote key events through the native focus system rather than invoking the contextual actions directly.

The acceptance covers remote focus navigation and activation, intro, recap and credits seek behaviour, Next Video focus and collision priority, automatic mode generation scoping and fail closed live, unseekable and Never states.

This harness is representative Android TV runtime evidence only. It is not the private Stremio Android TV application, it does not prove Stremio maintainer adoption and it does not provide real TV display mode or physical panel and speaker A V evidence. Those remain separate release gates under the Foundation hardware acceptance issue.
