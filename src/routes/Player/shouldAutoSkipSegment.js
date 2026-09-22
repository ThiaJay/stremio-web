// Copyright (C) 2017-2023 Smart code 203358507

const sameSegment = (dismissal, segment) => dismissal !== null &&
    dismissal.generation === segment.generation &&
    dismissal.kind === segment.kind &&
    dismissal.from === segment.from &&
    dismissal.to === segment.to;

const shouldAutoSkipSegment = ({
    segment,
    target,
    dismissal,
    paused,
    nextVideoPopupOpen,
}) => {
    return segment !== null &&
        target !== null &&
        paused === false &&
        !nextVideoPopupOpen &&
        (segment.mode ?? 'ask') === 'always' &&
        !segment.dismissed &&
        !sameSegment(dismissal, segment);
};

module.exports = shouldAutoSkipSegment;
