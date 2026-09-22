// Copyright (C) 2017-2023 Smart code 203358507

const getSegmentKey = (segment) => {
    if (!segment || !['intro', 'recap', 'outro'].includes(segment.kind) ||
        !Number.isSafeInteger(segment.generation) || segment.generation <= 0 ||
        typeof segment.videoId !== 'string' || !segment.videoId.length ||
        !Number.isSafeInteger(segment.from) || !Number.isSafeInteger(segment.to) ||
        segment.from < 0 || segment.to <= segment.from) {
        return null;
    }
    return JSON.stringify([segment.generation, segment.videoId, segment.kind, segment.from, segment.to]);
};

const sameSegment = (dismissal, segment) => Boolean(dismissal && segment &&
    dismissal.generation === segment.generation &&
    dismissal.videoId === segment.videoId &&
    dismissal.kind === segment.kind && dismissal.from === segment.from && dismissal.to === segment.to);

module.exports = { getSegmentKey, sameSegment };
