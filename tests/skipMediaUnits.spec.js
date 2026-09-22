// Copyright (C) 2017-2023 Smart code 203358507

const getTarget = require('../src/routes/Player/getSkipSegmentTarget');
const automatic = require('../src/routes/Player/shouldAutoSkipSegment');
const commit = require('../src/routes/Player/commitSkipSegment');
const createAttempt = require('../src/routes/Player/createSkipSegmentAttempt');

const segment = {
    kind: 'intro', generation: 1, videoId: 'episode', from: 210000, to: 244500,
    duration: 2850000, seekTo: 244500, mode: 'always', active: true, dismissed: false,
};
const playback = {
    segment, time: 220000, duration: 2850000, mode: 'always', livePlayback: false,
    canSeek: true, streamReady: true, currentVideoMatches: true,
};

test('the player and Core seek interfaces both retain milliseconds', () => {
    const target = getTarget(playback);
    expect(target).toBe(244500);
    const calls = [];
    expect(commit({ segment, target, attempt: createAttempt(),
        dismiss: () => calls.push('consume'), seek: value => calls.push(value) })).toBe(true);
    expect(calls).toEqual(['consume', 244500]);
    // The actual stremio-video HTML actuator converts milliseconds to seconds.
    // The real browser tests independently verify the resulting media position.
    expect(calls[1] / 1000).toBe(244.5);
});

test('a target converted to seconds too early cannot pass the media command gate', () => {
    const seek = jest.fn();
    expect(commit({ segment, target: 244.5, attempt: createAttempt(),
        dismiss: jest.fn(), seek })).toBe(false);
    expect(seek).not.toHaveBeenCalled();
});

test('paused playback and Next Episode priority remain independent hard gates', () => {
    const state = { segment, target: 244500, dismissal: null, paused: false, nextVideoPopupOpen: false };
    expect(automatic(state)).toBe(true);
    expect(automatic({ ...state, paused: true })).toBe(false);
    expect(automatic({ ...state, nextVideoPopupOpen: true })).toBe(false);
});
