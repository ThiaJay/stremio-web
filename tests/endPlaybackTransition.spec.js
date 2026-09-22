// Copyright (C) 2017-2023 Smart code 203358507

const getEndPlaybackTransition = require('../src/routes/Player/getEndPlaybackTransition');

describe('getEndPlaybackTransition', () => {
    test('advances only when auto play is enabled and Core has a directly playable next video', () => {
        expect(getEndPlaybackTransition({
            isEpg: false,
            hasNextVideo: true,
            hasPlayableNextVideo: true,
            bingeWatching: true,
        })).toBe('advance');
    });

    test('stays in the ended player when auto play is disabled', () => {
        expect(getEndPlaybackTransition({
            isEpg: false,
            hasNextVideo: true,
            hasPlayableNextVideo: true,
            bingeWatching: false,
        })).toBe('stay');
    });

    test('fails closed when a next episode exists without an exact playable continuation', () => {
        expect(getEndPlaybackTransition({
            isEpg: false,
            hasNextVideo: true,
            hasPlayableNextVideo: false,
            bingeWatching: true,
        })).toBe('stay');
    });

    test('goes back when there is no next episode', () => {
        expect(getEndPlaybackTransition({
            isEpg: false,
            hasNextVideo: false,
            hasPlayableNextVideo: false,
            bingeWatching: true,
        })).toBe('back');
    });

    test('leaves live playback navigation alone', () => {
        expect(getEndPlaybackTransition({
            isEpg: true,
            hasNextVideo: true,
            hasPlayableNextVideo: true,
            bingeWatching: true,
        })).toBe('none');
    });
});
