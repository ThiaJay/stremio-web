const createBridge = require('../src/routes/Player/avSyncV2Bridge');
function setup() {
    let now = 5000;
    const dispatch = jest.fn();
    const correct = jest.fn();
    const bridge = createBridge({ dispatch, correct, clock: () => now });
    const sample = { sessionId: 1, epoch: 2, sampleId: 8, capturedAtMs: 5000, offsetMs: 400, active: true, videoStable: true, canSoftCorrect: true, canHardCorrect: false };
    const request = { sessionId: 1, epoch: 2, sampleId: 8, generation: 1, issuedAtMs: 5000, expiresAtMs: 6500, correction: 'nativeClock' };
    const model = { selected: {}, avSyncV2: { protocolVersion: 2, sessionId: 1, pending: request } };
    const state = { loaded: true, paused: false, buffering: false, avSyncV2: sample, manifest: { props: ['avSyncV2'], commands: ['correctAvSyncV2'] } };
    return { bridge, dispatch, correct, sample, request, model, state, set: (value) => { now = value; } };
}
test('forwards measured timing once without private metadata', () => {
    const x = setup(); x.sample.sourceUrl = 'private'; x.bridge.observe(x.sample, x.model, x.state, false); x.bridge.observe(x.sample, x.model, x.state, false);
    expect(x.dispatch).toHaveBeenCalledTimes(1); expect(x.dispatch.mock.calls[0][0].args.action).toBe('AvSyncV2Observed'); expect(JSON.stringify(x.dispatch.mock.calls)).not.toContain('private');
});
test('recovery is dispatched once and never converted to a local audio delay', () => {
    const x = setup(); x.bridge.recover(x.request, x.model, x.state, false); x.bridge.recover(x.request, x.model, x.state, false);
    expect(x.correct).toHaveBeenCalledTimes(1); expect(x.correct).toHaveBeenCalledWith(x.request); expect(x.dispatch).not.toHaveBeenCalled();
});
test.each(['sessionId', 'epoch', 'sampleId', 'generation', 'issuedAtMs', 'expiresAtMs'])('invalid %s is rejected', (key) => {
    const x = setup(); x.request[key] = -1; x.bridge.recover(x.request, x.model, x.state, false); expect(x.correct).not.toHaveBeenCalled();
});
test.each(['pause', 'buffering', 'seeking', 'notLoaded', 'healthRecovery', 'unsupported', 'otherSession', 'otherEpoch', 'oldSample', 'expired', 'future', 'wrongCorrection', 'videoUnstable'])('blocks %s before native dispatch', (condition) => {
    const x = setup(); let seeking = false;
    if (condition === 'pause') x.state.paused = true;
    if (condition === 'buffering') x.state.buffering = true;
    if (condition === 'seeking') seeking = true;
    if (condition === 'notLoaded') x.state.loaded = false;
    if (condition === 'healthRecovery') x.model.playbackHealth = { recovery: 'transcodeAudio' };
    if (condition === 'unsupported') x.state.manifest.commands = [];
    if (condition === 'otherSession') x.request.sessionId = 2;
    if (condition === 'otherEpoch') x.request.epoch = 1;
    if (condition === 'oldSample') x.request.sampleId = 7;
    if (condition === 'expired') x.set(6501);
    if (condition === 'future') x.request.issuedAtMs = 5500;
    if (condition === 'wrongCorrection') x.request.correction = 'adjustAudioDelay';
    if (condition === 'videoUnstable') x.sample.videoStable = false;
    x.bridge.recover(x.request, x.model, x.state, seeking); expect(x.correct).not.toHaveBeenCalled();
});
test('acknowledgement is forwarded only for the pending request and only once', () => {
    const x = setup(); const ack = { sessionId: 1, epoch: 2, generation: 1, accepted: true };
    x.bridge.acknowledge({ ...ack, epoch: 1 }, x.model); expect(x.dispatch).not.toHaveBeenCalled();
    x.bridge.acknowledge(ack, x.model); x.bridge.acknowledge(ack, x.model); expect(x.dispatch).toHaveBeenCalledTimes(1); expect(x.dispatch.mock.calls[0][0].args.action).toBe('AvSyncV2Acknowledged');
});
test('heartbeat is an expiry message and never a fake observation', () => {
    const x = setup(); x.bridge.tick(x.model); expect(x.dispatch.mock.calls[0][0].args.action).toBe('AvSyncV2Tick'); expect(x.dispatch.mock.calls[0][0].args.args).toEqual({ sessionId: 1, nowMs: 5000 });
});
test('old Core packages remain unchanged', () => {
    const x = setup(); delete x.model.avSyncV2; x.bridge.observe(x.sample, x.model, x.state, false); x.bridge.recover(x.request, x.model, x.state, false); x.bridge.tick(x.model); expect(x.dispatch).not.toHaveBeenCalled(); expect(x.correct).not.toHaveBeenCalled();
});
test('state changes cannot reissue an old observation as fresh timing', () => {
    const x = setup(); x.bridge.observe(x.sample, x.model, x.state, false); x.set(5500); x.state.buffering = true; x.bridge.observe(x.sample, x.model, x.state, false); expect(x.dispatch).toHaveBeenCalledTimes(1);
});
test('foreign and malformed samples are rejected', () => {
    for (const change of [{ sessionId: 2 }, { capturedAtMs: 5001 }, { capturedAtMs: 0 }, { offsetMs: NaN }, { offsetMs: '400' }, { videoStable: undefined }]) {
        const x = setup(); x.bridge.observe({ ...x.sample, ...change }, x.model, x.state, false); expect(x.dispatch).not.toHaveBeenCalled();
    }
});
