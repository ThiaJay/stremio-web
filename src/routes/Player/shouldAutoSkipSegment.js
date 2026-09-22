// Copyright (C) 2017-2023 Smart code 203358507

const { getSegmentKey, sameSegment } = require('./skipSegmentIdentity');

const shouldAutoSkipSegment = ({ segment, target, dismissal, paused, nextVideoPopupOpen } = {}) => {
    return getSegmentKey(segment) !== null && Number.isSafeInteger(target) && target > 0 &&
        target === segment.seekTo && target === segment.to && paused === false &&
        nextVideoPopupOpen === false && segment.mode === 'always' &&
        segment.active === true && segment.dismissed === false && !sameSegment(dismissal, segment);
};

module.exports = shouldAutoSkipSegment;
