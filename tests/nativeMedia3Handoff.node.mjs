import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const policy = require('../src/routes/Player/nativeMedia3Handoff.js');

test('never offers native playback in an ordinary browser', () => {
    assert.equal(policy.bridgeForWindow({}), null);
    assert.equal(policy.bridgeForWindow(null), null);
    assert.equal(policy.bridgeForWindow({ stremioEnhancedTvNative: {} }), null);
});
test('requires an explicitly selected ready direct HTTPS source', () => {
    const url = 'https://media.example.org/clip.mp4';
    assert.equal(policy.eligibleUrl({url}, true, {url}), url);
    assert.equal(policy.eligibleUrl({url}, false, {url}), null);
    assert.equal(policy.eligibleUrl({url}, true, null), null);
    assert.equal(policy.eligibleUrl({}, true, {url}), null);
});
test('forbids private network, secrets, non-HTTPS and arbitrary scheme URLs', () => {
    for (const url of ['http://host.example.org/media.mp4',
        'https://127.0.0.1/a.mp4', 'https://host.local/a',
        'https://media.example.org:8443/a', 'https://user:pass@media.example.org/a',
        'javascript:alert(1)', 'file:///etc/passwd', 'magnet:?xt=123',
        'https://host.test/a', 'https://media.example.org/a#fragment',
        'https://media.example.org/', 'https://media.example.org/a\nb']) {
        assert.equal(policy.eligibleUrl({url}, true, {url}), null, url);
    }
});
test('an explicit invocation transmits exactly one versioned message', () => {
    const messages = [];
    const bridge = policy.bridgeForWindow({
        stremioEnhancedTvNative: {postMessage: (s) => messages.push(JSON.parse(s))}
    });
    const url = 'https://media.example.org/master.m3u8?fixture=1';
    assert.equal(policy.requestNativePlayback(bridge, url), true);
    assert.deepEqual(messages, [{v:1, type:'play', url}]);
    assert.equal(policy.requestNativePlayback(bridge, 'http://localhost/evil'), false);
    assert.equal(messages.length, 1);
});
test('a missing or broken bridge fails without a network request', () => {
    const url = 'https://media.example.org/a.mp4';
    assert.equal(policy.requestNativePlayback(null, url), false);
    assert.equal(policy.requestNativePlayback({postMessage:()=>{throw new Error('off');}},url),false);
});
