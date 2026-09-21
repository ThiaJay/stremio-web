// Copyright (C) 2017-2023 Smart code 203358507

const shouldAutoSkipIntro = ({
    mode,
    target,
    dismissal,
    stream,
    intro,
}) => {
    if ((mode ?? 'ask') !== 'always' || target === null || intro === null) {
        return false;
    }

    return dismissal === null ||
        dismissal.stream !== stream ||
        dismissal.from !== intro.from ||
        dismissal.to !== intro.to;
};

module.exports = shouldAutoSkipIntro;
