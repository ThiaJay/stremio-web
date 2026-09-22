// Copyright (C) 2017-2023 Smart code 203358507

const shouldAutoSkipSegment = ({ segment, target }) => {
    return segment !== null &&
        target !== null &&
        (segment.mode ?? 'ask') === 'always' &&
        !segment.dismissed;
};

module.exports = shouldAutoSkipSegment;
