// Native MPV timing telemetry. Correction remains owned by the native player.
// No source URLs, media identifiers, device names, timers or network requests.
function AvSyncTelemetry(clock) {
    var now = clock || function() {
        return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : NaN;
    };
    var session = 0;
    var sequence = 0;
    var lastObservedAt = null;
    var lastPublishedAt = null;
    var reading = null;

    this.reset = function() {
        reading = null;
        lastObservedAt = null;
        lastPublishedAt = null;
        session = session < Number.MAX_SAFE_INTEGER ? session + 1 : session;
    };

    this.observe = function(seconds, active) {
        var timestamp = now();
        if (active !== true || typeof seconds !== 'number' || !Number.isFinite(seconds) ||
            Math.abs(seconds) > 60 || !Number.isFinite(timestamp) || timestamp < 0 ||
            (lastObservedAt !== null && timestamp < lastObservedAt) ||
            sequence === Number.MAX_SAFE_INTEGER || session === Number.MAX_SAFE_INTEGER) {
            var changed = reading !== null;
            reading = null;
            return changed;
        }
        lastObservedAt = timestamp;
        if (lastPublishedAt !== null && timestamp - lastPublishedAt < 500) return false;
        lastPublishedAt = timestamp;
        sequence += 1;
        reading = Object.freeze({
            offsetMs: Math.round(seconds * 1000) || 0,
            sampleId: sequence,
            sessionId: session,
            capturedAtMs: timestamp,
            buffering: false,
            seeking: false,
            refreshRateSwitching: false,
            canSoftCorrect: false,
            canHardCorrect: false,
            telemetryOnly: true
        });
        return true;
    };

    this.snapshot = function(active) {
        var timestamp = now();
        if (active !== true || reading === null || !Number.isFinite(timestamp) ||
            timestamp < reading.capturedAtMs || timestamp - reading.capturedAtMs > 1500) return null;
        return reading;
    };
}

module.exports = AvSyncTelemetry;
