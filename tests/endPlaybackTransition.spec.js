// Copyright (C) 2017-2023 Smart code 203358507

const getEndPlaybackTransition = require('../src/routes/Player/getEndPlaybackTransition');

describe('getEndPlaybackTransition', () => {
    test('advances only when next video exists and auto play is enabled', () => {
        expect(getEndPlaybackTransition({
            isEpg: false,
            hasNextVideo: true,
            bingeWatching: true,
        })).toBe('advance');
    });

    test('does not advance when auto play is disabled', () => {
        expect(getEndPlaybackTransition({
            isEpg: false,
            hasNextVideo: true,
            bingeWatching: false,
        })).toBe('back');
    });

    test('goes back when there is no next video', () => {
        expect(getEndPlaybackTransition({
            isEpg: false,
            hasNextVideo: false,
            bingeWatching: true,
        })).toBe('back');
    });

    test('leaves live playback navigation alone', () => {
        expect(getEndPlaybackTransition({
            isEpg: true,
            hasNextVideo: true,
            bingeWatching: true,
        })).toBe('none');
    });
});
