// Copyright (C) 2017-2023 Smart code 203358507

const sameSegment = (dismissal, segment) => dismissal !== null &&
    dismissal.generation === segment.generation &&
    dismissal.kind === segment.kind &&
    dismissal.from === segment.from &&
    dismissal.to === segment.to;

const getSkipSegmentPopupOpen = ({
    segment,
    target,
    nextVideoPopupOpen,
    dismissal,
}) => {
    if (segment === null || target === null || nextVideoPopupOpen) {
        return false;
    }

    return (segment.mode ?? 'ask') === 'ask' &&
        !segment.dismissed &&
        !sameSegment(dismissal, segment);
};

module.exports = getSkipSegmentPopupOpen;
