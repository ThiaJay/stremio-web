// Copyright (C) 2017-2023 Smart code 203358507

const MILLISECONDS_PER_SECOND = 1000;

const getSkipSegmentTarget = ({
    segment,
    livePlayback,
    canSeek,
    streamReady,
    currentVideoMatches,
}) => {
    if (livePlayback || !canSeek || !streamReady || !currentVideoMatches || segment === null) {
        return null;
    }

    if (!segment.active || segment.dismissed || segment.seekTo === null) {
        return null;
    }

    if (!Number.isFinite(segment.from) ||
        !Number.isFinite(segment.to) ||
        !Number.isFinite(segment.duration) ||
        !Number.isFinite(segment.seekTo)) {
        return null;
    }

    if (segment.duration <= 0 ||
        segment.from < 0 ||
        segment.to <= segment.from ||
        segment.to > segment.duration ||
        segment.seekTo !== segment.to) {
        return null;
    }

    return segment.seekTo / MILLISECONDS_PER_SECOND;
};

module.exports = getSkipSegmentTarget;
