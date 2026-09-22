'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const moduleFile = process.env.LOCAL_TELEMETRY_FILE || path.join(path.dirname(require.resolve('@stremio/stremio-video/package.json')), 'src/ShellVideo/AvSyncTelemetry.js');
const Telemetry = require(moduleFile);
const { transform } = require('./prepare.cjs');

function setup() {
    let time = 1000;
    return { meter: new Telemetry(() => time), set: (value) => { time = value; } };
}

test('unknown timing is not reported as zero', () => {
    const { meter } = setup();
    assert.equal(meter.snapshot(true), null);
});
test('native seconds preserve sign when converted to milliseconds', () => {
    for (const [seconds, expected] of [[0.12, 120], [-0.42, -420], [0, 0], [0.0006, 1]]) {
        const { meter } = setup();
        assert.equal(meter.observe(seconds, true), true);
        assert.equal(meter.snapshot(true).offsetMs, expected);
    }
});
test('invalid timing is rejected rather than coerced', () => {
    for (const value of [null, undefined, '', '0.12', true, NaN, Infinity, -Infinity, 61, -61]) {
        const { meter } = setup();
        meter.observe(value, true);
        assert.equal(meter.snapshot(true), null);
    }
});
test('inactive playback cannot supply a sample', () => {
    const { meter } = setup();
    meter.observe(0.1, false);
    assert.equal(meter.snapshot(true), null);
    meter.observe(0.1, true);
    assert.equal(meter.snapshot(false), null);
});
test('a transient invalidates the previous measurement', () => {
    const { meter } = setup();
    meter.observe(0.1, true);
    assert.equal(meter.observe(0.1, false), true);
    assert.equal(meter.snapshot(true), null);
});
test('sample publication is bounded by elapsed time', () => {
    const { meter, set } = setup();
    meter.observe(0.1, true);
    set(1499);
    assert.equal(meter.observe(0.2, true), false);
    assert.equal(meter.snapshot(true).sampleId, 1);
    set(1500);
    assert.equal(meter.observe(0.2, true), true);
    assert.equal(meter.snapshot(true).sampleId, 2);
});
test('expired measurements are not reissued as fresh samples', () => {
    const { meter, set } = setup();
    meter.observe(0.1, true);
    set(2501);
    assert.equal(meter.snapshot(true), null);
});
test('load reset discards readings and changes session identity', () => {
    const { meter } = setup();
    meter.observe(0.1, true);
    const before = meter.snapshot(true);
    meter.reset();
    assert.equal(meter.snapshot(true), null);
    meter.observe(0.2, true);
    const after = meter.snapshot(true);
    assert.ok(after.sessionId > before.sessionId);
    assert.ok(after.sampleId > before.sampleId);
});
test('clock reversal cannot make a sample look recent', () => {
    const { meter, set } = setup();
    meter.observe(0.1, true);
    set(999);
    assert.equal(meter.snapshot(true), null);
    meter.observe(0.2, true);
    assert.equal(meter.snapshot(true), null);
});
test('missing monotonic clock fails closed', () => {
    const meter = new Telemetry(() => NaN);
    meter.observe(0.1, true);
    assert.equal(meter.snapshot(true), null);
});
test('measurements are immutable and contain no media or account identifiers', () => {
    const { meter } = setup();
    meter.observe(0.1, true);
    const sample = meter.snapshot(true);
    assert.ok(Object.isFrozen(sample));
    assert.deepEqual(Object.keys(sample).sort(), ['offsetMs', 'sampleId', 'sessionId', 'capturedAtMs', 'buffering', 'seeking', 'refreshRateSwitching', 'canSoftCorrect', 'canHardCorrect', 'telemetryOnly'].sort());
    assert.equal(sample.canSoftCorrect, false);
    assert.equal(sample.canHardCorrect, false);
});
test('unavailable native property clears the old reading', () => {
    const { meter } = setup();
    meter.observe(0.1, true);
    assert.equal(meter.observe(undefined, true), true);
    assert.equal(meter.snapshot(true), null);
});
test('source drift and double application are rejected', () => {
    assert.throws(() => transform('not the expected upstream source'));
});

test('the real patched ShellVideo receives native timing without correction writes', { skip: Boolean(process.env.LOCAL_TELEMETRY_FILE) }, async () => {
    const root = path.dirname(require.resolve('@stremio/stremio-video/package.json'));
    const source = fs.readFileSync(path.join(root, 'src/ShellVideo/ShellVideo.js'), 'utf8');
    assert.throws(() => transform(source));
    const ipc = new EventEmitter();
    const writes = [];
    ipc.send = (name, value) => writes.push([name, value]);
    const out = { exports: {} };
    vm.runInNewContext(source, {
        require: (id) => id === './AvSyncTelemetry' ? Telemetry : id === '../error' ? require(path.join(root, 'src/error.js')) : require(require.resolve(id, { paths: [root] })),
        module: out,
        console: { log() {}, error() {} },
        window: { document: { getElementsByTagName: () => [] } },
        performance,
        setTimeout,
        clearTimeout
    });
    const ShellVideo = out.exports;
    assert.ok(ShellVideo.manifest.props.includes('avSync'));
    assert.ok(!ShellVideo.manifest.commands.includes('correctAvSync'));
    const player = new ShellVideo({ shellTransport: ipc, containerElement: { style: {}, parentElement: null } });
    const samples = [];
    player.on('propChanged', (name, value) => { if (name === 'avSync') samples.push(value); });
    player.dispatch({ type: 'observeProp', propName: 'avSync' });
    ipc.emit('mpv-prop-change', { name: 'mpv-version', data: '0.40.0' });
    player.dispatch({ type: 'command', commandName: 'load', commandArgs: { stream: { url: 'https://example.invalid/test.mp4' }, time: 0 } });
    await Promise.resolve();
    for (const [name, data] of [['duration', 120], ['video-params', {}], ['paused-for-cache', false], ['seeking', false], ['pause', false], ['aid', 1], ['vid', 1]]) {
        ipc.emit('mpv-prop-change', { name, data });
    }
    const before = writes.length;
    ipc.emit('mpv-prop-change', { name: 'avsync', data: 0.12 });
    assert.equal(samples.at(-1).offsetMs, 120);
    assert.equal(writes.length, before);
    ipc.emit('mpv-prop-change', { name: 'seeking', data: true });
    assert.equal(samples.at(-1), null);
    ipc.emit('mpv-prop-change', { name: 'paused-for-cache', data: true });
    ipc.emit('mpv-prop-change', { name: 'seeking', data: false });
    ipc.emit('mpv-prop-change', { name: 'avsync', data: 0.5 });
    assert.equal(samples.at(-1), null, 'Seek completion must not override ongoing buffering');
    ipc.emit('mpv-prop-change', { name: 'paused-for-cache', data: false });
    ipc.emit('mpv-prop-change', { name: 'eof-reached', data: true });
    ipc.emit('mpv-prop-change', { name: 'avsync', data: 0.5 });
    assert.equal(samples.at(-1), null, 'Ended playback must not report fresh timing');
    player.dispatch({ type: 'command', commandName: 'unload' });
    ipc.emit('mpv-prop-change', { name: 'avsync', data: 0.5 });
    assert.equal(samples.at(-1), null);
    player.dispatch({ type: 'command', commandName: 'destroy' });
    const count = samples.length;
    ipc.emit('mpv-prop-change', { name: 'avsync', data: 0.5 });
    assert.equal(samples.length, count);
});
