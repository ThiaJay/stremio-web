// Copyright (C) 2017-2023 Smart code 203358507

const getSkipIntroPopupOpen = ({
    mode,
    target,
    nextVideoPopupOpen,
    dismissal,
    stream,
    intro,
}) => {
    if ((mode ?? 'ask') !== 'ask' || target === null || nextVideoPopupOpen || intro === null) {
        return false;
    }

    return dismissal === null ||
        dismissal.stream !== stream ||
        dismissal.from !== intro.from ||
        dismissal.to !== intro.to;
};

module.exports = getSkipIntroPopupOpen;
