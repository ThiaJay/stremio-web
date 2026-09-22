// Copyright (C) 2017-2023 Smart code 203358507

const getEndPlaybackTransition = ({
    isEpg,
    hasNextVideo,
    bingeWatching,
}) => {
    if (isEpg) {
        return 'none';
    }

    if (hasNextVideo && bingeWatching) {
        return 'advance';
    }

    return 'back';
};

module.exports = getEndPlaybackTransition;
