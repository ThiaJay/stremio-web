// Copyright (C) 2017-2023 Smart code 203358507

const { getSegmentKey, sameSegment } = require('./skipSegmentIdentity');

const getSkipSegmentPopupOpen = ({ segment, target, nextVideoPopupOpen, dismissal } = {}) => {
    return getSegmentKey(segment) !== null && Number.isSafeInteger(target) && target > 0 &&
        target === segment.seekTo && target === segment.to && nextVideoPopupOpen === false &&
        segment.mode === 'ask' && segment.active === true && segment.dismissed === false &&
        !sameSegment(dismissal, segment);
};

module.exports = getSkipSegmentPopupOpen;
