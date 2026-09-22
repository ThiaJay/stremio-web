// Copyright (C) 2017-2023 Smart code 203358507

const getSkipSegmentPopupOpen = ({
    segment,
    target,
    nextVideoPopupOpen,
}) => {
    if (segment === null || target === null || nextVideoPopupOpen) {
        return false;
    }

    return (segment.mode ?? 'ask') === 'ask' && !segment.dismissed;
};

module.exports = getSkipSegmentPopupOpen;
