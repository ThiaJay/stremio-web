'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

// Exercise the installed package itself, not a duplicate recovery policy.
const packageRoot = path.dirname(require.resolve('@stremio/stremio-video/package.json'));
const source = fs.readFileSync(path.join(packageRoot, 'src/ShellVideo/ShellVideo.js'), 'utf8');
const errorDefinitions = require(path.join(packageRoot, 'src/error.js'));

function fixture() {
    const exported = { exports: {} };
    const context = {
        module: exported,
        console: { log() {} },
        window: { document: { getElementsByTagName: () => [] } },
        require(name) {
            if (name === 'eventemitter3') return EventEmitter;
            if (name === 'lodash.clonedeep') return structuredClone;
            if (name === 'deep-freeze') return Object.freeze;
            if (name === '../error') return errorDefinitions;
            throw new Error('Unexpected dependency ' + name);
        },
    };
    vm.runInNewContext(source, context, { filename: 'ShellVideo.js' });
    const ipc = new EventEmitter();
    const sent = [];
    ipc.send = (event, payload) => sent.push({ event, payload });
    const video = new exported.exports({ shellTransport: ipc, containerElement: { style: {} } });
    const changed = [];
    video.on('propChanged', (name, value) => changed.push({ name, value }));
    const command = (name, args) => video.dispatch({ type: 'command', commandName: name, commandArgs: args });
    const observe = (name) => video.dispatch({ type: 'observeProp', propName: name });
    const prop = (name, data) => ipc.emit('mpv-prop-change', { name, data });
    const loads = () => sent.filter((item) => item.event === 'mpv-command' && item.payload[0] === 'loadfile');
    const load = (url) => command('load', { stream: { url }, time: 42000, hardwareDecoding: true, platform: 'windows' });
    return { video, ipc, sent, changed, command, observe, prop, loads, load, manifest: exported.exports.manifest };
}
const settle = async () => { await new Promise((resolve) => setImmediate(resolve)); };

test('only the newest pending source reaches the real MPV transport', async () => {
    const f = fixture();
    f.load('https://media.example/old.mkv');
    f.load('https://media.example/new.mkv');
    f.prop('mpv-version', '0.39.0');
    await settle();
    assert.equal(f.loads().length, 1);
    assert.equal(f.loads()[0].payload[1], 'https://media.example/new.mkv');
});

test('unloading invalidates pending native player preparation', async () => {
    const f = fixture();
    f.load('https://media.example/film.mkv');
    f.command('unload');
    f.prop('mpv-version', '0.39.0');
    await settle();
    assert.equal(f.loads().length, 0);
});

test('destroyed native players cannot restart from a delayed version result', async () => {
    const f = fixture();
    f.load('https://media.example/film.mkv');
    f.prop('mpv-version', '0.39.0');
    f.command('destroy');
    const count = f.sent.length;
    await settle();
    assert.equal(f.sent.length, count);
    assert.equal(f.loads().length, 0);
});

test('source observation reports the selected stream and clears on unload', async () => {
    const f = fixture();
    f.observe('stream');
    f.load('https://media.example/film.mkv');
    f.prop('mpv-version', '0.39.0');
    await settle();
    assert.equal(f.changed.filter((item) => item.name === 'stream').at(-1).value.url, 'https://media.example/film.mkv');
    f.command('unload');
    assert.equal(f.changed.filter((item) => item.name === 'stream').at(-1).value, null);
});

test('ending a seek does not clear a still active cache wait', () => {
    const f = fixture();
    f.observe('buffering');
    f.prop('seeking', true);
    f.prop('paused-for-cache', true);
    f.prop('seeking', false);
    assert.equal(f.changed.filter((item) => item.name === 'buffering').at(-1).value, true);
    f.prop('paused-for-cache', false);
    assert.equal(f.changed.filter((item) => item.name === 'buffering').at(-1).value, false);
});

test('ending a cache wait does not clear a still active seek', () => {
    const f = fixture();
    f.observe('buffering');
    f.prop('paused-for-cache', true);
    f.prop('seeking', true);
    f.prop('paused-for-cache', false);
    assert.equal(f.changed.filter((item) => item.name === 'buffering').at(-1).value, true);
    f.prop('seeking', false);
    assert.equal(f.changed.filter((item) => item.name === 'buffering').at(-1).value, false);
});

test('late native events cannot change a destroyed player', () => {
    const f = fixture();
    f.observe('buffering');
    f.command('destroy');
    const count = f.sent.length;
    const changes = f.changed.length;
    f.prop('paused-for-cache', true);
    f.ipc.emit('mpv-event-video-ready', { loadId: 1, ready: true });
    f.ipc.emit('mpv-event-ended', { reason: 'eof' });
    assert.equal(f.sent.length, count);
    assert.equal(f.changed.length, changes);
});

test('normal native playback retains its resume point and hardware video path', async () => {
    const f = fixture();
    f.load('https://media.example/film.mkv');
    f.prop('mpv-version', '0.39.0');
    await settle();
    assert.equal(f.loads().length, 1);
    assert.equal(f.loads()[0].payload.at(-1), 'start=+42');
    assert.ok(f.sent.some((item) => item.event === 'mpv-set-prop' && item.payload[0] === 'hwdec' && item.payload[1] === 'auto'));
});

test('an adapter never advertises recovery or timing actuators it does not implement', () => {
    const f = fixture();
    assert.equal(f.manifest.commands.includes('recoverPlayback'), false);
    assert.equal(f.manifest.commands.includes('correctAvSync'), false);
});
