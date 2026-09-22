// Copyright (C) 2017-2023 Smart code 203358507

const commit = require('../src/routes/Player/commitSkipSegment');
const createAttempt = require('../src/routes/Player/createSkipSegmentAttempt');
const segment = { kind: 'intro', generation: 2, videoId: 'episode', from: 1000, to: 7000, seekTo: 7000 };

const fixture = () => {
    const calls = [];
    return { calls, args: { segment, target: 7000, attempt: createAttempt(),
        dismiss: () => calls.push('consume'), seek: target => calls.push(target),
        onError: () => calls.push('error') } };
};

test('Core consumption precedes the seek that removes the descriptor', () => {
    const { args, calls } = fixture();
    expect(commit(args)).toBe(true);
    expect(calls).toEqual(['consume', 7000]);
});
test('failed synchronous Core dispatch cannot cause a media seek or replay', () => {
    const { args, calls } = fixture();
    args.dismiss = () => { throw new Error('dispatch unavailable'); };
    expect(commit(args)).toBe(false);
    expect(commit(args)).toBe(false);
    expect(calls).toEqual(['error']);
});
test('explicitly rejected dismissal prevents the seek', () => {
    const { args, calls } = fixture();
    args.dismiss = () => false;
    expect(commit(args)).toBe(false);
    expect(calls).toEqual([]);
});
test('unknown media outcome remains consumed and cannot seek twice', () => {
    const { args, calls } = fixture();
    args.seek = () => { calls.push('seek'); throw new Error('acknowledgement lost'); };
    expect(commit(args)).toBe(false);
    expect(commit(args)).toBe(false);
    expect(calls).toEqual(['consume', 'seek', 'error']);
});
test('rapid activation cannot duplicate Core consumption or media seek', () => {
    const { args, calls } = fixture();
    for (let index = 0; index < 100; index++) commit(args);
    expect(calls).toEqual(['consume', 7000]);
});
test('malformed activation cannot claim or seek', () => {
    expect(commit()).toBe(false);
    const { args, calls } = fixture();
    for (const target of [null, undefined, 0, -1, 7001, NaN, Infinity]) {
        expect(commit({ ...args, target })).toBe(false);
    }
    expect(calls).toEqual([]);
    expect(commit(args)).toBe(true);
});
