// Copyright (C) 2017-2023 Smart code 203358507

const getEndPlaybackTransition = ({
    isEpg,
    hasNextVideo,
    hasPlayableNextVideo,
    bingeWatching,
}) => {
    if (isEpg) {
        return 'none';
    }

    if (!hasNextVideo) {
        return 'back';
    }

    if (bingeWatching && hasPlayableNextVideo) {
        return 'advance';
    }

    return 'stay';
};

module.exports = getEndPlaybackTransition;
