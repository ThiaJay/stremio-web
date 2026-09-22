// Copyright (C) 2017-2023 Smart code 203358507

const getSkipSegmentTarget = require('../src/routes/Player/getSkipSegmentTarget');
const getSkipSegmentPopupOpen = require('../src/routes/Player/getSkipSegmentPopupOpen');
const shouldAutoSkipSegment = require('../src/routes/Player/shouldAutoSkipSegment');

const segment = {
    kind: 'intro',
    generation: 4,
    videoId: 'tt0903747:1:5',
    from: 227500,
    to: 244500,
    duration: 2889000,
    mode: 'ask',
    active: true,
    dismissed: false,
    seekTo: 244500,
};

const valid = {
    segment,
    livePlayback: false,
    canSeek: true,
    streamReady: true,
    currentVideoMatches: true,
};

describe('getSkipSegmentTarget', () => {
    test.each(['intro', 'recap', 'outro'])('uses the Core seek target for an active %s', (kind) => {
        expect(getSkipSegmentTarget({
            ...valid,
            segment: { ...segment, kind },
        })).toBe(244.5);
    });

    test.each([
        ['live playback', { livePlayback: true }],
        ['unseekable playback', { canSeek: false }],
        ['stream not loaded', { streamReady: false }],
        ['stale or different video', { currentVideoMatches: false }],
        ['missing segment', { segment: null }],
    ])('fails closed for %s', (_name, override) => {
        expect(getSkipSegmentTarget({ ...valid, ...override })).toBeNull();
    });

    test('does not expose inactive or Core-dismissed segments', () => {
        expect(getSkipSegmentTarget({
            ...valid,
            segment: { ...segment, active: false },
        })).toBeNull();
        expect(getSkipSegmentTarget({
            ...valid,
            segment: { ...segment, dismissed: true },
        })).toBeNull();
    });

    test.each([
        ['start', { from: NaN }],
        ['end', { to: NaN }],
        ['duration', { duration: NaN }],
        ['seek target', { seekTo: NaN }],
    ])('fails closed for invalid %s', (_name, override) => {
        expect(getSkipSegmentTarget({
            ...valid,
            segment: { ...segment, ...override },
        })).toBeNull();
    });

    test('rejects mismatched Core seek geometry', () => {
        expect(getSkipSegmentTarget({
            ...valid,
            segment: { ...segment, seekTo: segment.to - 1 },
        })).toBeNull();
    });
});

describe('getSkipSegmentPopupOpen', () => {
    const state = {
        segment,
        target: segment.to / 1000,
        nextVideoPopupOpen: false,
        dismissal: null,
    };

    test('opens the same contextual prompt for intro recap and credits in Ask mode', () => {
        for (const kind of ['intro', 'recap', 'outro']) {
            expect(getSkipSegmentPopupOpen({
                ...state,
                segment: { ...segment, kind },
            })).toBe(true);
        }
    });

    test.each(['always', 'never'])('does not open the prompt in %s mode', (mode) => {
        expect(getSkipSegmentPopupOpen({
            ...state,
            segment: { ...segment, mode },
        })).toBe(false);
    });

    test('gives next-video popup priority', () => {
        expect(getSkipSegmentPopupOpen({ ...state, nextVideoPopupOpen: true })).toBe(false);
    });

    test('local dismissal is bound to the exact Core segment generation', () => {
        const dismissal = {
            generation: segment.generation,
            kind: segment.kind,
            from: segment.from,
            to: segment.to,
        };
        expect(getSkipSegmentPopupOpen({ ...state, dismissal })).toBe(false);
        expect(getSkipSegmentPopupOpen({
            ...state,
            dismissal: { ...dismissal, generation: segment.generation - 1 },
        })).toBe(true);
    });
});

describe('shouldAutoSkipSegment', () => {
    const automatic = { ...segment, mode: 'always' };

    test.each(['intro', 'recap', 'outro'])('auto skips a trusted active %s once', (kind) => {
        expect(shouldAutoSkipSegment({
            segment: { ...automatic, kind },
            target: automatic.to / 1000,
            dismissal: null,
            paused: false,
            nextVideoPopupOpen: false,
        })).toBe(true);
    });

    test.each(['ask', 'never'])('does not auto skip in %s mode', (mode) => {
        expect(shouldAutoSkipSegment({
            segment: { ...automatic, mode },
            target: automatic.to / 1000,
            dismissal: null,
            paused: false,
            nextVideoPopupOpen: false,
        })).toBe(false);
    });

    test('does not auto skip while paused or while Next Episode has priority', () => {
        expect(shouldAutoSkipSegment({
            segment: automatic,
            target: automatic.to / 1000,
            dismissal: null,
            paused: true,
            nextVideoPopupOpen: false,
        })).toBe(false);
        expect(shouldAutoSkipSegment({
            segment: automatic,
            target: automatic.to / 1000,
            dismissal: null,
            paused: false,
            nextVideoPopupOpen: true,
        })).toBe(false);
    });

    test('does not repeat an already consumed segment', () => {
        const dismissal = {
            generation: automatic.generation,
            kind: automatic.kind,
            from: automatic.from,
            to: automatic.to,
        };
        expect(shouldAutoSkipSegment({
            segment: automatic,
            target: automatic.to / 1000,
            dismissal,
            paused: false,
            nextVideoPopupOpen: false,
        })).toBe(false);
    });
});
