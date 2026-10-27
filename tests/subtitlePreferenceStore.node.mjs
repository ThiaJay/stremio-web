import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const fresh = () => import(`../src/routes/Player/intelligentSubtitles/preference-store.mjs?case=${Math.random()}`);
const entropy = (fill = 0xab) => (length) => new Uint8Array(length).fill(fill);

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  const operations = [];
  return {
    operations,
    getItem(key) { operations.push(['get', key]); return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { operations.push(['set', key, value]); values.set(key, value); },
    removeItem(key) { operations.push(['remove', key]); values.delete(key); },
    snapshot() { return Object.fromEntries(values); },
  };
}

const enabled = Object.freeze({ enabled: true, language: 'eng', source: 'embedded' });

test('Foundation runtime modules retain their exact reviewed Git blob identities', async () => {
  for (const [name, expected] of [
    ['preference-provenance.mjs', 'e63e9a35ec9e0bdeab0de17debaf5a3ce929d8d4'],
    ['preference-receipt.mjs', 'f1f5adaadc552f97b598bf8db48685d86782853e'],
  ]) {
    const content = await readFile(new URL("../src/routes/Player/intelligentSubtitles/" + name, import.meta.url));
    const actual = createHash('sha1').update(`blob ${content.byteLength}\0`).update(content).digest('hex');
    assert.equal(actual, expected);
  }
});

test('module import performs no storage or identity action', async () => {
  globalThis.localStorage = new Proxy({}, { get() { throw new Error('storage accessed on import'); } });
  await fresh();
  delete globalThis.localStorage;
});

test('hydrated enabled state cannot create consent without a trusted UI surface', async () => {
  const { recordExplicitLocalChoice } = await fresh();
  const storage = memoryStorage();
  assert.equal(recordExplicitLocalChoice({ storage, randomBytes: entropy(), sessionPreference: enabled }), null);
  assert.deepEqual(storage.snapshot(), {});
});

test('explicit first-run choice writes, reads back and promotes exact local evidence', async () => {
  const { recordExplicitLocalChoice, loadStoredPreference } = await fresh();
  const storage = memoryStorage();
  const promoted = recordExplicitLocalChoice({
    storage, randomBytes: entropy(), sessionPreference: enabled, globalLanguage: 'ENG', surface: 'first-run',
  });
  assert.equal(promoted.kind, 'same-installation-setting');
  assert.equal(promoted.installationDigest, 'ab'.repeat(32));
  assert.equal(promoted.preferenceRevision, 1);
  assert.deepEqual(loadStoredPreference({ storage, sessionPreference: enabled, globalLanguage: 'eng' }), promoted);
});

test('settings choice reuses identity and increments the bounded revision', async () => {
  const { recordExplicitLocalChoice } = await fresh();
  const storage = memoryStorage();
  const first = recordExplicitLocalChoice({
    storage, randomBytes: entropy(0x11), sessionPreference: enabled, surface: 'first-run',
  });
  const second = recordExplicitLocalChoice({
    storage, randomBytes: () => { throw new Error('must reuse identity'); },
    sessionPreference: enabled, surface: 'subtitle-settings',
  });
  assert.equal(first.installationDigest, '11'.repeat(32));
  assert.equal(second.installationDigest, first.installationDigest);
  assert.equal(second.preferenceRevision, 2);
});

test('explicit Off remains authoritative and is never converted into consent', async () => {
  const { recordExplicitLocalChoice } = await fresh();
  const storage = memoryStorage();
  assert.equal(recordExplicitLocalChoice({
    storage, randomBytes: entropy(), sessionPreference: { enabled: false }, surface: 'first-run',
  }), null);
  assert.deepEqual(storage.snapshot(), {});
});

test('cross-installation and altered bindings fail closed on load', async () => {
  const { recordExplicitLocalChoice, loadStoredPreference, INSTALLATION_DIGEST_KEY } = await fresh();
  const storage = memoryStorage();
  recordExplicitLocalChoice({
    storage, randomBytes: entropy(), sessionPreference: enabled, globalLanguage: 'eng', surface: 'first-run',
  });
  assert.equal(loadStoredPreference({ storage, sessionPreference: { ...enabled, language: 'spa' }, globalLanguage: 'eng' }), null);
  storage.setItem(INSTALLATION_DIGEST_KEY, 'cd'.repeat(32));
  assert.equal(loadStoredPreference({ storage, sessionPreference: enabled, globalLanguage: 'eng' }), null);
});

test('corrupt, injected and oversized receipts are rejected without replacement', async () => {
  const { recordExplicitLocalChoice, INSTALLATION_DIGEST_KEY, PREFERENCE_RECEIPT_KEY } = await fresh();
  for (const raw of ['{', JSON.stringify({ schemaVersion: 1, scope: 'installation-local', receipt: {}, account: true }), 'x'.repeat(4097)]) {
    const seed = { [INSTALLATION_DIGEST_KEY]: 'aa'.repeat(32), [PREFERENCE_RECEIPT_KEY]: raw };
    const storage = memoryStorage(seed);
    assert.equal(recordExplicitLocalChoice({ storage, randomBytes: entropy(), sessionPreference: enabled, surface: 'first-run' }), null);
    assert.deepEqual(storage.snapshot(), seed);
  }
});

test('revision overflow fails closed without replacing stored evidence', async () => {
  const { recordExplicitLocalChoice, INSTALLATION_DIGEST_KEY, PREFERENCE_RECEIPT_KEY } = await fresh();
  const installationDigest = 'aa'.repeat(32);
  const receipt = {
    schemaVersion: 1,
    kind: 'explicit-local-choice',
    installationDigest,
    preferenceRevision: Number.MAX_SAFE_INTEGER,
    surface: 'first-run',
    choice: 'enabled',
    binding: {
      sessionEnabled: true,
      sessionLanguage: 'eng',
      globalLanguage: null,
      sessionSource: 'embedded',
    },
  };
  const seed = {
    [INSTALLATION_DIGEST_KEY]: installationDigest,
    [PREFERENCE_RECEIPT_KEY]: JSON.stringify({ schemaVersion: 1, scope: 'installation-local', receipt }),
  };
  const storage = memoryStorage(seed);
  assert.equal(recordExplicitLocalChoice({
    storage, randomBytes: entropy(), sessionPreference: enabled, surface: 'subtitle-settings',
  }), null);
  assert.deepEqual(storage.snapshot(), seed);
});

test('receipt write refusal restores a newly created identity', async () => {
  const { recordExplicitLocalChoice, PREFERENCE_RECEIPT_KEY } = await fresh();
  const storage = memoryStorage();
  const originalSet = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === PREFERENCE_RECEIPT_KEY) throw new Error('quota');
    originalSet.call(storage, key, value);
  };
  assert.equal(recordExplicitLocalChoice({
    storage, randomBytes: entropy(), sessionPreference: enabled, surface: 'first-run',
  }), null);
  assert.deepEqual(storage.snapshot(), {});
});

test('mutated receipt readback triggers verified rollback', async () => {
  const { recordExplicitLocalChoice, INSTALLATION_DIGEST_KEY, PREFERENCE_RECEIPT_KEY } = await fresh();
  const original = {
    [INSTALLATION_DIGEST_KEY]: 'aa'.repeat(32),
  };
  const storage = memoryStorage(original);
  const originalSet = storage.setItem;
  let mutate = true;
  storage.setItem = (key, value) => {
    originalSet.call(storage, key, mutate && key === PREFERENCE_RECEIPT_KEY ? `${value} ` : value);
    if (key === PREFERENCE_RECEIPT_KEY) mutate = false;
  };
  assert.equal(recordExplicitLocalChoice({
    storage, randomBytes: entropy(), sessionPreference: enabled, surface: 'first-run',
  }), null);
  assert.deepEqual(storage.snapshot(), original);
});

test('inputs are not mutated and storage source names no accounts or network APIs', async () => {
  const module = await fresh();
  const storage = memoryStorage();
  const preference = { enabled: true, language: 'ENG', source: 'external' };
  const before = structuredClone(preference);
  assert.ok(module.recordExplicitLocalChoice({
    storage, randomBytes: entropy(), sessionPreference: preference,
    globalLanguage: 'ENG', surface: 'subtitle-settings',
  }));
  assert.deepEqual(preference, before);
  const source = await readFile(new URL('../src/routes/Player/intelligentSubtitles/preference-store.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|account|deviceId|packageName/i);
});
