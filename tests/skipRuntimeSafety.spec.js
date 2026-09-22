// Copyright (C) 2017-2023 Smart code 203358507

const target = require('../src/routes/Player/getSkipSegmentTarget');
const popup = require('../src/routes/Player/getSkipSegmentPopupOpen');
const automatic = require('../src/routes/Player/shouldAutoSkipSegment');
const attempts = require('../src/routes/Player/createSkipSegmentAttempt');
const { getSegmentKey } = require('../src/routes/Player/skipSegmentIdentity');
const segment = { kind: 'intro', generation: 4, videoId: 'tt9999999:1:1', from: 10000,
    to: 20000, duration: 120000, seekTo: 20000, mode: 'ask', active: true, dismissed: false };
const valid = { segment, time: 15000, duration: 120000, mode: 'ask', livePlayback: false,
    canSeek: true, streamReady: true, currentVideoMatches: true };

describe('shared skip runtime safety', () => {
    test('missing inputs never throw or offer a target', () => {
        expect(target()).toBeNull(); expect(popup()).toBe(false); expect(automatic()).toBe(false);
    });
    test.each([9999, 20000, 20001, NaN, Infinity, null, undefined, '15000'])('stale local time %s cannot seek', (time) => {
        expect(target({ ...valid, time })).toBeNull();
    });
    test.each([16000, 119999, 120001, NaN, Infinity, null, undefined])('changed actuator duration %s cannot seek', (duration) => {
        expect(target({ ...valid, duration })).toBeNull();
    });
    test.each(['intro', 'recap', 'outro'])('valid shared %s target is preserved', (kind) => {
        expect(target({ ...valid, segment: { ...segment, kind } })).toBe(20000);
    });
    test.each(['intro', 'recap'])('%s cannot terminate playback', (kind) => {
        expect(target({ ...valid, segment: { ...segment, kind, to: 120000, seekTo: 120000 } })).toBeNull();
    });
    test('credits may end at duration as Core specifies', () => {
        expect(target({ ...valid, segment: { ...segment, kind: 'outro', to: 120000, seekTo: 120000 } })).toBe(120000);
    });
    test.each([
        { generation: 0 }, { generation: Number.MAX_SAFE_INTEGER + 1 }, { videoId: '' },
        { kind: 'preview' }, { kind: 'unknown' }, { from: -1 }, { from: 10000.5 },
        { to: Infinity }, { seekTo: 19999 }, { active: 1 }, { dismissed: 0 },
        { mode: 'never' }, { mode: 'unknown' },
    ])('malformed or stale descriptor fails closed', (change) => {
        expect(target({ ...valid, segment: { ...segment, ...change } })).toBeNull();
    });
    test.each(['never', 'unknown', 'always', undefined])('pending preference change %s revokes stale Ask target', (mode) => {
        expect(target({ ...valid, mode })).toBeNull();
    });
    test.each([true, null, undefined])('automatic action waits whilst paused state is %s', (paused) => {
        expect(automatic({ segment: { ...segment, mode: 'always' }, target: 20000,
            dismissal: null, paused, nextVideoPopupOpen: false })).toBe(false);
    });
    test('Next Video wins over automatic skipping too', () => {
        expect(automatic({ segment: { ...segment, mode: 'always' }, target: 20000,
            dismissal: null, paused: false, nextVideoPopupOpen: true })).toBe(false);
    });
    test('rapid activations are claimed once before asynchronous state updates', () => {
        const ledger = attempts(); let count = 0;
        for (let i = 0; i < 100; i++) if (ledger.claim(segment)) count++;
        expect(count).toBe(1);
    });
    test('recap then intro then rewind cannot automatically replay recap', () => {
        const ledger = attempts(); const recap = { ...segment, kind: 'recap' };
        expect(ledger.claim(recap)).toBe(true); expect(ledger.claim(segment)).toBe(true);
        expect(ledger.claim(recap)).toBe(false); expect(ledger.has(recap)).toBe(true);
    });
    test('new lifecycle permits actions and rejects late older lifecycle', () => {
        const ledger = attempts(); ledger.claim(segment);
        expect(ledger.claim({ ...segment, generation: 5 })).toBe(true);
        expect(ledger.claim({ ...segment, kind: 'recap' })).toBe(false);
    });
    test('unknown seek outcomes cannot replay the claimed action', () => {
        const ledger = attempts();
        try { if (ledger.claim(segment)) throw new Error('lost acknowledgement'); } catch (_) { /* retained */ }
        expect(ledger.claim(segment)).toBe(false);
    });
    test('untrusted changing evidence cannot grow the claim ledger without limit', () => {
        const ledger = attempts();
        for (let i = 0; i < 64; i++) expect(ledger.claim({ ...segment, from: i, to: i + 1 })).toBe(true);
        expect(ledger.claim({ ...segment, from: 70, to: 80 })).toBe(false);
        expect(ledger.claim({ ...segment, generation: 5 })).toBe(true);
    });
    test('dismissal includes the video identity', () => {
        const args = { segment, target: 20000, nextVideoPopupOpen: false, dismissal: segment };
        expect(popup(args)).toBe(false);
        expect(popup({ ...args, dismissal: { ...segment, videoId: 'another-video' } })).toBe(true);
        expect(getSegmentKey({ ...segment, videoId: 'another-video' })).not.toBe(getSegmentKey(segment));
    });
    test('boundary sweep never seeks outside the current window', () => {
        for (let time = 0; time <= 120000; time += 97) {
            expect(target({ ...valid, time })).toBe(time >= 10000 && time < 20000 ? 20000 : null);
        }
    });
});
