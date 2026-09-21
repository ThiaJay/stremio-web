// Copyright (C) 2017-2023 Smart code 203358507

const getSkipIntroTarget = require('../src/routes/Player/getSkipIntroTarget');
const getSkipIntroPopupOpen = require('../src/routes/Player/getSkipIntroPopupOpen');
const shouldAutoSkipIntro = require('../src/routes/Player/shouldAutoSkipIntro');

const valid = {
    intro: { from: 227500, to: 244500 },
    time: 233000,
    duration: 2889000,
    livePlayback: false,
    canSeek: true,
    streamReady: true,
    currentVideoMatches: true,
};

describe('getSkipIntroTarget', () => {
    test('returns the intro end while playback is inside a valid intro', () => {
        expect(getSkipIntroTarget(valid)).toBe(244500);
    });

    test('becomes available exactly at the intro start', () => {
        expect(getSkipIntroTarget({ ...valid, time: 227500 })).toBe(244500);
    });

    test('is unavailable before the intro starts', () => {
        expect(getSkipIntroTarget({ ...valid, time: 227499 })).toBeNull();
    });

    test('is unavailable at and after the intro end', () => {
        expect(getSkipIntroTarget({ ...valid, time: 244500 })).toBeNull();
        expect(getSkipIntroTarget({ ...valid, time: 244501 })).toBeNull();
    });

    test.each([
        ['live playback', { livePlayback: true }],
        ['unseekable playback', { canSeek: false }],
        ['stream not loaded', { streamReady: false }],
        ['stale or different video', { currentVideoMatches: false }],
        ['missing intro', { intro: null }],
    ])('fails closed for %s', (_name, override) => {
        expect(getSkipIntroTarget({ ...valid, ...override })).toBeNull();
    });

    test.each([
        ['time', { time: NaN }],
        ['duration', { duration: NaN }],
        ['intro start', { intro: { from: NaN, to: 244500 } }],
        ['intro end', { intro: { from: 227500, to: NaN } }],
    ])('fails closed for invalid %s', (_name, override) => {
        expect(getSkipIntroTarget({ ...valid, ...override })).toBeNull();
    });

    test.each([
        ['zero duration', { duration: 0 }],
        ['negative intro start', { intro: { from: -1, to: 244500 } }],
        ['zero length intro', { intro: { from: 227500, to: 227500 } }],
        ['reversed intro', { intro: { from: 244500, to: 227500 } }],
        ['intro beyond stream duration', { intro: { from: 227500, to: 2890000 } }],
    ])('rejects invalid segment geometry for %s', (_name, override) => {
        expect(getSkipIntroTarget({ ...valid, ...override })).toBeNull();
    });

    test('does not surface stale intro data during a new episode load', () => {
        const staleIntro = getSkipIntroTarget({
            ...valid,
            currentVideoMatches: false,
            streamReady: false,
        });
        expect(staleIntro).toBeNull();

        const currentIntro = getSkipIntroTarget(valid);
        expect(currentIntro).toBe(244500);
    });
});


describe('getSkipIntroPopupOpen', () => {
    const intro = { from: 227500, to: 244500 };
    const state = {
        mode: 'ask',
        target: 244500,
        nextVideoPopupOpen: false,
        dismissal: null,
        stream: 'stream-a',
        intro,
    };

    test('opens for an active intro in Ask mode', () => {
        expect(getSkipIntroPopupOpen(state)).toBe(true);
    });

    test('stays compatible when an older profile has no Skip Intro mode', () => {
        expect(getSkipIntroPopupOpen({ ...state, mode: undefined })).toBe(true);
    });

    test.each(['always', 'never'])('does not open the prompt in %s mode', (mode) => {
        expect(getSkipIntroPopupOpen({ ...state, mode })).toBe(false);
    });

    test('does not open when there is no active skip target', () => {
        expect(getSkipIntroPopupOpen({ ...state, target: null })).toBe(false);
    });

    test('gives next-video popup priority', () => {
        expect(getSkipIntroPopupOpen({ ...state, nextVideoPopupOpen: true })).toBe(false);
    });

    test('stays dismissed for the same stream and intro', () => {
        expect(getSkipIntroPopupOpen({
            ...state,
            dismissal: { stream: 'stream-a', from: 227500, to: 244500 },
        })).toBe(false);
    });

    test('reopens for a different source or different intro', () => {
        const dismissal = { stream: 'stream-a', from: 227500, to: 244500 };

        expect(getSkipIntroPopupOpen({
            ...state,
            stream: 'stream-b',
            dismissal,
        })).toBe(true);

        expect(getSkipIntroPopupOpen({
            ...state,
            intro: { from: 228000, to: 245000 },
            dismissal,
        })).toBe(true);
    });
});


describe('shouldAutoSkipIntro', () => {
    const intro = { from: 227500, to: 244500 };
    const state = {
        mode: 'always',
        target: 244500,
        dismissal: null,
        stream: 'stream-a',
        intro,
    };

    test('auto skips once in Always mode', () => {
        expect(shouldAutoSkipIntro(state)).toBe(true);
    });

    test.each(['ask', 'never'])('does not auto skip in %s mode', (mode) => {
        expect(shouldAutoSkipIntro({ ...state, mode })).toBe(false);
    });

    test('does not auto skip without an active intro target', () => {
        expect(shouldAutoSkipIntro({ ...state, target: null })).toBe(false);
    });

    test('does not repeat automatic skip for the same stream and intro', () => {
        expect(shouldAutoSkipIntro({
            ...state,
            dismissal: { stream: 'stream-a', from: 227500, to: 244500 },
        })).toBe(false);
    });

    test('can auto skip again for a different source or intro', () => {
        const dismissal = { stream: 'stream-a', from: 227500, to: 244500 };
        expect(shouldAutoSkipIntro({ ...state, stream: 'stream-b', dismissal })).toBe(true);
        expect(shouldAutoSkipIntro({
            ...state,
            intro: { from: 228000, to: 245000 },
            dismissal,
        })).toBe(true);
    });
});
