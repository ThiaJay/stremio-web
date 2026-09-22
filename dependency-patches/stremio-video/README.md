# Native playback dependency workspace

This workspace removes the requirement for a separate writable stremio-video fork. It uses the existing authorised Stremio Web repository and pnpm dependency patches. It does not grant upstream repository access or change account permissions.

## Source and scope

The target is the released `@stremio/stremio-video@0.0.98` package from Stremio. Its MIT licence and original authorship remain unchanged. Package installation retains the existing dependency integrity checks. Source anchors must match exactly once. An unexpected release or changed source stops preparation rather than applying an approximate edit.

The first native change exposes MPV timing measurements through `ShellVideo`. It reports actual `avsync` values in milliseconds with a monotonic capture time and sample identity. Measurements are suppressed during unavailable or interrupted playback and discarded on lifecycle changes. No media URLs, account details or device names enter the measurement.

## Safety boundary

This candidate only measures timing. It does not advertise `correctAvSync` and never changes audio delay, playback speed or stream position. Native correction remains disabled until the shared policy has session binding, freshness checks, elapsed time based persistence, acknowledgement and bounded recovery budgets. Passing these tests is not evidence of physical lip synchronisation or official Android TV support.

HTML playback and other native backends remain unchanged. The official Android TV app remains a separate source and integration boundary. The unrelated community Android client is not substituted for it.

## Reproducible validation

The workflow installs the locked release, prepares the dependency patch, regenerates the package manager lock and verifies a frozen installation. It checks the actual installed MPV adapter, runs the native timing tests and then runs the normal Web build, tests and lint.

Only after all validation passes does a separate job save the generated patch, lock and proof to this isolated branch. It verifies that the branch has not moved and never force pushes. It cannot modify upstream repositories or the installed application. No personal access token or account administration is required.

Generated working directories are removed. Workflow evidence expires after seven days. The committed patch and its source hashes remain the durable evidence.
