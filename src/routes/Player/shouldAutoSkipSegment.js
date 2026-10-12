// Copyright (C) 2017-2023 Smart code 203358507

const { getSegmentKey, sameSegment } = require('./skipSegmentIdentity');

const shouldAutoSkipSegment = ({ segment, mode, target, dismissal, paused, nextVideoPopupOpen } = {}) => {
    const effectiveMode = mode === undefined ? segment?.mode : mode;
    return getSegmentKey(segment) !== null && Number.isSafeInteger(target) && target > 0 &&
        target === segment.seekTo && target === segment.to && paused === false &&
        nextVideoPopupOpen === false && effectiveMode === 'always' &&
        segment.active === true && segment.dismissed === false && !sameSegment(dismissal, segment);
};

module.exports = shouldAutoSkipSegment;
