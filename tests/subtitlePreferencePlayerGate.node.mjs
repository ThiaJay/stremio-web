import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import policy from '../src/routes/Player/enhancedSubtitlePolicy.js';
import {
    INSTALLATION_DIGEST_KEY,
    PREFERENCE_RECEIPT_KEY,
    recordExplicitLocalChoice,
} from '../src/routes/Player/intelligentSubtitles/preference-store.mjs';
import {
    PLAYER_PREFERENCE_EVENT,
    PLAYER_STORAGE_KEYS,
    readPlayerSubtitleAutomation,
} from '../src/routes/Player/intelligentSubtitles/preference-player-gate.mjs';

class MemoryStorage {
    constructor(entries = []) {
        this.values = new Map(entries);
    }
    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }
    setItem(key, value) {
        this.values.set(key, String(value));
    }
    removeItem(key) {
        this.values.delete(key);
    }
}

const entropy = (length) => new Uint8Array(length).fill(0x2a);
const smart = policy.normalise(null);
const record = (storage, options = smart) => {
    storage.setItem(policy.STORAGE_KEY, JSON.stringify(options));
    return recordExplicitLocalChoice({
        storage,
        randomBytes: entropy,
        sessionPreference: { enabled: true, language: options.subtitleLanguages[0] },
        globalLanguage: null,
        surface: 'subtitle-settings',
    });
};

test('default Smart policy cannot become player consent without a local receipt', () => {
    const gate = readPlayerSubtitleAutomation({ storage: new MemoryStorage(), options: smart });
    assert.deepEqual(gate, {
        subtitle: false,
        audio: false,
        reason: 'installation_preference_unverified',
        provenance: null,
    });
    assert.equal(Object.isFrozen(gate), true);
});

test('exact installation-local readback enables both bounded automation paths', () => {
    const storage = new MemoryStorage();
    assert.ok(record(storage));
    const gate = readPlayerSubtitleAutomation({ storage, options: smart });
    assert.equal(gate.subtitle, true);
    assert.equal(gate.audio, true);
    assert.equal(gate.reason, 'installation_preference_verified');
    assert.equal(gate.provenance?.kind, 'same-installation-setting');
});

test('Always On also requires the exact bound local receipt', () => {
    const options = { ...smart, mode: 'on' };
    const storage = new MemoryStorage();
    assert.equal(readPlayerSubtitleAutomation({ storage, options }).subtitle, false);
    assert.ok(record(storage, options));
    assert.equal(readPlayerSubtitleAutomation({ storage, options }).subtitle, true);
});

test('changed language, corrupt receipt and cross-installation identity fail closed', () => {
    const storage = new MemoryStorage();
    assert.ok(record(storage));
    const changed = { ...smart, subtitleLanguages: ['fr'] };
    assert.equal(readPlayerSubtitleAutomation({ storage, options: changed }).subtitle, false);

    const receipt = storage.getItem(PREFERENCE_RECEIPT_KEY);
    storage.setItem(PREFERENCE_RECEIPT_KEY, `${receipt}x`);
    assert.equal(readPlayerSubtitleAutomation({ storage, options: smart }).subtitle, false);

    storage.setItem(PREFERENCE_RECEIPT_KEY, receipt);
    storage.setItem(INSTALLATION_DIGEST_KEY, 'b'.repeat(64));
    assert.equal(readPlayerSubtitleAutomation({ storage, options: smart }).subtitle, false);
});

test('malformed stored policy cannot reuse a valid local receipt', () => {
    const storage = new MemoryStorage();
    assert.ok(record(storage));
    storage.setItem(policy.STORAGE_KEY, '{');
    const normalizedFallback = policy.read(storage);
    assert.deepEqual(normalizedFallback, smart);
    assert.equal(readPlayerSubtitleAutomation({
        storage,
        options: normalizedFallback,
    }).subtitle, false);
});

test('stale or non-canonical policy cannot reuse a receipt with the same language', () => {
    const storage = new MemoryStorage();
    assert.ok(record(storage));
    const stale = { ...smart, preferUnderstoodAudio: false };
    assert.equal(readPlayerSubtitleAutomation({ storage, options: stale }).subtitle, false);
    storage.setItem(policy.STORAGE_KEY, JSON.stringify({ ...smart, injected: true }));
    assert.equal(readPlayerSubtitleAutomation({ storage, options: smart }).subtitle, false);
});

test('explicit Off may disable subtitles but cannot drive audio automation', () => {
    const gate = readPlayerSubtitleAutomation({
        storage: new MemoryStorage(),
        options: { ...smart, mode: 'off' },
    });
    assert.deepEqual(gate, {
        subtitle: true,
        audio: false,
        reason: 'subtitles_disabled',
        provenance: null,
    });
});

test('original Stremio mode inherits subtitle handling and blocks enhanced audio', () => {
    const gate = readPlayerSubtitleAutomation({
        storage: null,
        options: { ...smart, mode: 'stremio' },
    });
    assert.deepEqual(gate, {
        subtitle: true,
        audio: false,
        reason: 'stremio_selected',
        provenance: null,
    });
});

test('both production player hooks consume the same gate and storage-key set', async () => {
    const [subtitles, audio, gateSource] = await Promise.all([
        readFile(new URL('../src/routes/Player/useSubtitles.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/routes/Player/useAudio.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/routes/Player/intelligentSubtitles/preference-player-gate.mjs', import.meta.url), 'utf8'),
    ]);
    for (const source of [subtitles, audio]) {
        assert.match(source, /readPlayerSubtitleAutomation/);
        assert.match(source, /PLAYER_STORAGE_KEYS/);
        assert.match(source, /addEventListener\(PLAYER_PREFERENCE_EVENT, refresh\)/);
        assert.match(source, /removeEventListener\(PLAYER_PREFERENCE_EVENT, refresh\)/);
    }
    assert.match(subtitles, /enhancedAutomation\.subtitle/);
    assert.match(audio, /enhancedAutomation\.audio/);
    assert.deepEqual(PLAYER_STORAGE_KEYS, [
        policy.STORAGE_KEY,
        INSTALLATION_DIGEST_KEY,
        PREFERENCE_RECEIPT_KEY,
    ]);
    assert.equal(PLAYER_PREFERENCE_EVENT, 'stremio-enhanced:subtitle-preference-stored-v1');
    assert.doesNotMatch(gateSource, /accountHydrat|fetch\(|XMLHttpRequest|WebSocket|device|package/i);
});

