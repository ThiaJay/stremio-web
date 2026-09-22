'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const createBridge = require('../../src/routes/Player/avSyncV2Bridge');
const root = path.dirname(require.resolve('@stremio/stremio-video/package.json'));
const Session = require(path.join(root, 'src/ShellVideo/AvSyncSession'));
const binary = path.resolve('.contract-core/target/debug/examples/av_sync_contract');

function scenario(mode, shouldRecover, acknowledge = true) {
    let now = 1000;
    const actions = [], commands = [], pendingNative = [];
    let model = { selected: {}, avSyncV2: { protocolVersion: 2, sessionId: 1, pending: null, status: 'unknown' } };
    const video = { loaded: true, paused: false, buffering: false, avSyncV2: null, avSyncV2Ack: null, manifest: { props: ['avSyncV2'], commands: ['correctAvSyncV2'] } };
    function dispatch(action) {
        actions.push(action);
        const result = execFileSync(binary, [], { input: actions.map((item) => JSON.stringify(item)).join('\n') + '\n', encoding: 'utf8', timeout: 5000 });
        model = { ...model, avSyncV2: JSON.parse(result) };
    }
    const native = new Session({
        clock: () => now,
        getPlayback: () => ({ loaded: true, url: 'https://example.invalid/local-fixture.mkv' }),
        send: (name, args) => { commands.push([name, args]); pendingNative.push([name, args]); },
        emit: (name, value) => {
            if (name === 'avSyncV2') video.avSyncV2 = value;
            if (name === 'avSyncV2Ack') video.avSyncV2Ack = value;
        },
    });
    const bridge = createBridge({ dispatch, correct: (request) => native.correct(request), clock: () => now });
    native.begin(1);
    for (const [name, value] of Object.entries({ path: 'https://example.invalid/local-fixture.mkv', pause: false, seeking: false, 'paused-for-cache': false, 'eof-reached': false, aid: 1, vid: 1, speed: 1, duration: 120, 'time-pos': 30, seekable: true, 'video-sync': mode, 'audio-delay': 0, 'initial-audio-sync': true, 'frame-drop-count': 0, 'decoder-frame-drop-count': 0 })) native.update(name, value);
    for (let step = 0; step < 40; step += 1) {
        now += 500;
        native.observe(commands.length > 0 && acknowledge ? 0 : 0.4);
        bridge.observe(video.avSyncV2, model, video, false);
        bridge.recover(model.avSyncV2.pending, model, video, false);
        if (acknowledge) bridge.acknowledge(video.avSyncV2Ack, model);
        while (pendingNative.length > 0) {
            const [name, args] = pendingNative.shift();
            if (name === 'mpv-set-prop') native.update('video-sync', args[1]);
            else { native.update('seeking', true); native.update('seeking', false); }
        }
        bridge.tick(model);
    }
    assert.equal(commands.length, shouldRecover ? 1 : 0, 'Recovery command count');
    assert.equal(model.avSyncV2.status, shouldRecover ? acknowledge ? 'stable' : 'exhausted' : 'unsupported');
    for (const action of actions) assert.ok(!JSON.stringify(action).includes('example.invalid'), 'Source URLs must stay inside the native backend');
    return { mode, finalStatus: model.avSyncV2.status, commands, actionCount: actions.length };
}

const soft = scenario('display-resample', true);
assert.deepEqual(soft.commands[0], ['mpv-set-prop', ['file-local-options/video-sync', 'audio']]);
const hard = scenario('audio', true);
assert.deepEqual(hard.commands[0], ['mpv-command', ['seek', 0, 'relative+exact']]);
const disabled = scenario('desync', false);
const missingAck = scenario('display-resample', true, false);
console.log(JSON.stringify({ contract: 'passed', scenarios: [soft, hard, disabled, missingAck], physicalPlaybackAcceptance: false }));
