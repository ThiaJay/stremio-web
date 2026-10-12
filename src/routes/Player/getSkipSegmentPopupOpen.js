// Copyright (C) 2017-2023 Smart code 203358507

const { getSegmentKey, sameSegment } = require('./skipSegmentIdentity');

const getSkipSegmentPopupOpen = ({ segment, mode, target, nextVideoPopupOpen, dismissal } = {}) => {
    const effectiveMode = mode === undefined ? segment?.mode : mode;
    return getSegmentKey(segment) !== null && Number.isSafeInteger(target) && target > 0 &&
        target === segment.seekTo && target === segment.to && nextVideoPopupOpen === false &&
        effectiveMode === 'ask' && segment.active === true && segment.dismissed === false &&
        !sameSegment(dismissal, segment);
};

module.exports = getSkipSegmentPopupOpen;
