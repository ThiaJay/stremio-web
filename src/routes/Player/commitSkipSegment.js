// Copyright (C) 2017-2023 Smart code 203358507

const { getSegmentKey } = require('./skipSegmentIdentity');

// Consume in Core before seeking beyond the descriptor. A lost acknowledgement
// never authorises replaying the media command.
const commitSkipSegment = ({ segment, target, attempt, dismiss, seek, onError } = {}) => {
    if (getSegmentKey(segment) === null || !Number.isSafeInteger(target) ||
        target !== segment.to || target !== segment.seekTo || target <= 0 ||
        typeof attempt?.claim !== 'function' || typeof dismiss !== 'function' ||
        typeof seek !== 'function' || !attempt.claim(segment)) return false;
    try {
        if (dismiss() === false) return false;
        seek(target);
        return true;
    } catch (error) {
        onError?.(error);
        return false;
    }
};

module.exports = commitSkipSegment;
