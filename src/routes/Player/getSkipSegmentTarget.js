// Copyright (C) 2017-2023 Smart code 203358507

const { getSegmentKey } = require('./skipSegmentIdentity');

// Core resolves the segment. This only rechecks the current media actuator bounds.
const getSkipSegmentTarget = ({
    segment, time, duration, mode, livePlayback, canSeek, streamReady, currentVideoMatches,
} = {}) => {
    if (livePlayback !== false || canSeek !== true || streamReady !== true ||
        currentVideoMatches !== true || getSegmentKey(segment) === null) {
        return null;
    }
    if (segment.active !== true || segment.dismissed !== false ||
        !['ask', 'always'].includes(segment.mode) || segment.mode !== mode ||
        !Number.isSafeInteger(segment.duration) || !Number.isSafeInteger(segment.seekTo) ||
        !Number.isSafeInteger(duration) || !Number.isFinite(time)) {
        return null;
    }
    if (duration <= 0 || segment.duration !== duration || segment.to > duration ||
        (segment.kind !== 'outro' && segment.to === duration) ||
        segment.seekTo !== segment.to || time < segment.from || time >= segment.to) {
        return null;
    }
    return segment.seekTo;
};

module.exports = getSkipSegmentTarget;
