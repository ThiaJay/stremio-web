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

class DriftAfterPromotionStorage extends MemoryStorage {
    constructor(entries, mutate, mutateAt = 8) {
        super(entries);
        this.reads = 0;
        this.mutate = mutate;
        this.mutateAt = mutateAt;
    }
    getItem(key) {
        this.reads += 1;
        if (this.reads === this.mutateAt) this.mutate(this);
        return super.getItem(key);
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
    assert.equal(readPlayerSubtitleAutomation({
        storage,
        options: { ...smart, accountHydration: true },
    }).subtitle, false);
    storage.setItem(policy.STORAGE_KEY, JSON.stringify({ ...smart, injected: true }));
    assert.equal(readPlayerSubtitleAutomation({ storage, options: smart }).subtitle, false);
});

test('player promotion requires a stable policy, installation and receipt tuple', () => {
    const source = new MemoryStorage();
    assert.ok(record(source));
    const entries = [...source.values.entries()];
    const mutations = [
        (storage) => storage.values.set(
            policy.STORAGE_KEY,
            JSON.stringify({ ...smart, preferUnderstoodAudio: false }),
        ),
        (storage) => storage.values.set(INSTALLATION_DIGEST_KEY, 'b'.repeat(64)),
        (storage) => storage.values.set(
            PREFERENCE_RECEIPT_KEY,
            `${storage.values.get(PREFERENCE_RECEIPT_KEY)}x`,
        ),
    ];

    for (const mutate of mutations) {
        const storage = new DriftAfterPromotionStorage(entries, mutate);
        const gate = readPlayerSubtitleAutomation({ storage, options: smart });
        assert.equal(gate.subtitle, false);
        assert.equal(gate.audio, false);
        assert.equal(gate.reason, 'installation_preference_unverified');
        assert.equal(gate.provenance, null);
    }
});

test('explicit Off may disable subtitles but cannot drive audio automation', () => {
    const storage = new MemoryStorage();
    const options = { ...smart, mode: 'off' };
    storage.setItem(policy.STORAGE_KEY, JSON.stringify(options));
    const gate = readPlayerSubtitleAutomation({
        storage,
        options,
    });
    assert.deepEqual(gate, {
        subtitle: true,
        audio: false,
        reason: 'subtitles_disabled',
        provenance: null,
    });
});

test('original Stremio mode inherits subtitle handling and blocks enhanced audio', () => {
    const storage = new MemoryStorage();
    const options = { ...smart, mode: 'stremio' };
    storage.setItem(policy.STORAGE_KEY, JSON.stringify(options));
    const gate = readPlayerSubtitleAutomation({
        storage,
        options,
    });
    assert.deepEqual(gate, {
        subtitle: true,
        audio: false,
        reason: 'stremio_selected',
        provenance: null,
    });
});

test('Off and original Stremio require the same stable stored policy tuple', () => {
    const storage = new MemoryStorage();
    assert.ok(record(storage));
    for (const mode of ['off', 'stremio']) {
        const gate = readPlayerSubtitleAutomation({
            storage,
            options: { ...smart, mode },
        });
        assert.equal(gate.subtitle, false);
        assert.equal(gate.audio, false);
        assert.equal(gate.reason, 'installation_preference_unverified');
    }

    const off = { ...smart, mode: 'off' };
    const source = new MemoryStorage([[policy.STORAGE_KEY, JSON.stringify(off)]]);
    const drift = new DriftAfterPromotionStorage(
        [...source.values.entries()],
        (target) => target.values.set(policy.STORAGE_KEY, JSON.stringify(smart)),
        4,
    );
    assert.equal(readPlayerSubtitleAutomation({ storage: drift, options: off }).subtitle, false);
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

