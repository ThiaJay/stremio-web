import {
    subtitlePreferenceSnapshot,
    verifySubtitlePreferenceProvenance,
} from './preference-provenance.mjs';
import {
    issueExplicitLocalChoiceReceipt,
    promoteStoredPreferenceReceipt,
} from './preference-receipt.mjs';

export const INSTALLATION_DIGEST_KEY = 'stremio-enhanced.subtitle-provenance.installation.v1';
export const PREFERENCE_RECEIPT_KEY = 'stremio-enhanced.subtitle-provenance.receipt.v1';
export const PREFERENCE_REVISION_KEY = 'stremio-enhanced.subtitle-provenance.revision.v1';

const DIGEST = /^[0-9a-f]{64}$/;
const MAX_RECEIPT_BYTES = 4096;
const SURFACES = new Set(['first-run', 'subtitle-settings']);
const ENVELOPE_KEYS = ['schemaVersion', 'scope', 'receipt'];
const RECEIPT_KEYS = [
    'schemaVersion', 'kind', 'installationDigest', 'preferenceRevision',
    'surface', 'choice', 'binding',
];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const snapshotRequest = (value, allowedKeys, requiredKeys) => {
    try {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const descriptors = Object.getOwnPropertyDescriptors(value);
        const keys = Reflect.ownKeys(descriptors);
        if (keys.some((key) => typeof key !== 'string' || !allowedKeys.includes(key) ||
                !descriptors[key].enumerable || !own(descriptors[key], 'value')) ||
                requiredKeys.some((key) => !keys.includes(key))) return null;
        return Object.freeze(Object.fromEntries(
            keys.map((key) => [key, descriptors[key].value]),
        ));
    } catch {
        return null;
    }
};
const exactKeys = (value, keys) => value && typeof value === 'object' &&
    !Array.isArray(value) && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
const hasStorage = (storage) => storage &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function';
const safeGet = (storage, key) => {
    try {
        const value = storage.getItem(key);
        return value === null || typeof value === 'string' ? value : undefined;
    } catch {
        return undefined;
    }
};
const parseRevision = (value) => {
    if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && String(parsed) === value ? parsed : null;
};

const bytesToDigest = (bytes) => {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 32) return null;
    return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
};

// Restore only when every key still contains either its original value or a
// value written by this transaction. Unknown drift belongs to another writer
// and must never be overwritten by rollback.
const restore = (storage, snapshots, transactionWrites = []) => {
    try {
        const originals = new Map(snapshots);
        const written = new Map(transactionWrites);
        const current = snapshots.map(([key]) => [key, safeGet(storage, key)]);
        if (current.some(([, raw]) => raw === undefined) || current.some(([key, raw]) =>
            raw !== originals.get(key) && (!written.has(key) || raw !== written.get(key)))) return false;
        for (const [key, raw] of snapshots) {
            if (raw === null) storage.removeItem(key);
            else storage.setItem(key, raw);
        }
        return snapshots.every(([key, raw]) => safeGet(storage, key) === raw);
    } catch {
        return false;
    }
};

const parseEnvelope = (raw, installationDigest) => {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_RECEIPT_BYTES) return null;
    let envelope;
    try {
        envelope = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!exactKeys(envelope, ENVELOPE_KEYS) || envelope.schemaVersion !== 1 ||
            envelope.scope !== 'installation-local' || !exactKeys(envelope.receipt, RECEIPT_KEYS)) return null;
    const receipt = envelope.receipt;
    if (receipt.kind !== 'explicit-local-choice' || receipt.installationDigest !== installationDigest ||
            !Number.isSafeInteger(receipt.preferenceRevision) || receipt.preferenceRevision < 1) return null;
    const sessionPreference = {
        enabled: receipt.binding?.sessionEnabled,
        language: receipt.binding?.sessionLanguage,
        source: receipt.binding?.sessionSource,
    };
    if (!verifySubtitlePreferenceProvenance({
        activeInstallationDigest: installationDigest,
        sessionPreference,
        globalLanguage: receipt.binding?.globalLanguage,
        preferenceRevision: receipt.preferenceRevision,
        preferenceProvenance: receipt,
    })) return null;
    return Object.freeze({ envelope, receipt });
};

export function ensureInstallationDigest(input = {}) {
    const request = snapshotRequest(input, ['storage', 'randomBytes'], ['storage']);
    if (!request) return null;
    const { storage, randomBytes } = request;
    if (!hasStorage(storage)) return null;
    const before = safeGet(storage, INSTALLATION_DIGEST_KEY);
    if (before === undefined) return null;
    if (before !== null) return DIGEST.test(before) ? before : null;
    if (typeof randomBytes !== 'function') return null;
    let generated;
    try {
        generated = bytesToDigest(randomBytes(32));
    } catch {
        return null;
    }
    if (!generated) return null;
    try {
        storage.setItem(INSTALLATION_DIGEST_KEY, generated);
    } catch {
        restore(storage, [[INSTALLATION_DIGEST_KEY, before]], [[INSTALLATION_DIGEST_KEY, generated]]);
        return null;
    }
    if (safeGet(storage, INSTALLATION_DIGEST_KEY) !== generated) {
        restore(storage, [[INSTALLATION_DIGEST_KEY, before]], [[INSTALLATION_DIGEST_KEY, generated]]);
        return null;
    }
    return generated;
}

export function loadStoredPreference(input = {}) {
    const request = snapshotRequest(
        input,
        ['storage', 'sessionPreference', 'globalLanguage'],
        ['storage', 'sessionPreference'],
    );
    if (!request) return null;
    const { storage, sessionPreference, globalLanguage } = request;
    if (!hasStorage(storage)) return null;
    const installationDigest = safeGet(storage, INSTALLATION_DIGEST_KEY);
    if (!DIGEST.test(installationDigest || '')) return null;
    const revisionRaw = safeGet(storage, PREFERENCE_REVISION_KEY);
    const preferenceRevision = parseRevision(revisionRaw);
    if (preferenceRevision === null) return null;
    const receiptRaw = safeGet(storage, PREFERENCE_RECEIPT_KEY);
    const parsed = parseEnvelope(receiptRaw, installationDigest);
    if (!parsed || parsed.receipt.preferenceRevision !== preferenceRevision) return null;
    if (safeGet(storage, INSTALLATION_DIGEST_KEY) !== installationDigest ||
            safeGet(storage, PREFERENCE_REVISION_KEY) !== revisionRaw ||
            safeGet(storage, PREFERENCE_RECEIPT_KEY) !== receiptRaw) return null;
    return promoteStoredPreferenceReceipt({
        activeInstallationDigest: installationDigest,
        sessionPreference,
        globalLanguage,
        storedReceipt: parsed.receipt,
        storageReadback: {
            scope: 'installation-local',
            installationDigest,
            preferenceRevision: parsed.receipt.preferenceRevision,
            binding: parsed.receipt.binding,
        },
    });
}

export function recordExplicitLocalChoice(input = {}) {
    const request = snapshotRequest(
        input,
        ['storage', 'randomBytes', 'sessionPreference', 'globalLanguage', 'surface'],
        ['storage', 'sessionPreference', 'surface'],
    );
    if (!request) return null;
    const { storage, randomBytes, sessionPreference, globalLanguage, surface } = request;
    const preference = subtitlePreferenceSnapshot(sessionPreference);
    if (!hasStorage(storage) || !SURFACES.has(surface) || !preference ||
            preference.enabled !== true) return null;
    const digestBefore = safeGet(storage, INSTALLATION_DIGEST_KEY);
    const revisionBefore = safeGet(storage, PREFERENCE_REVISION_KEY);
    const receiptBefore = safeGet(storage, PREFERENCE_RECEIPT_KEY);
    if (digestBefore === undefined || revisionBefore === undefined ||
            receiptBefore === undefined) return null;
    const snapshots = [
        [INSTALLATION_DIGEST_KEY, digestBefore],
        [PREFERENCE_REVISION_KEY, revisionBefore],
        [PREFERENCE_RECEIPT_KEY, receiptBefore],
    ];
    if (digestBefore === null && (revisionBefore !== null || receiptBefore !== null)) return null;
    if ((revisionBefore === null) !== (receiptBefore === null)) return null;
    const installationDigest = ensureInstallationDigest({ storage, randomBytes });
    if (!installationDigest) return null;
    const digestWrite = [[INSTALLATION_DIGEST_KEY, installationDigest]];
    const rollbackDigest = () => restore(storage, snapshots, digestWrite);
    const previous = receiptBefore === null ? null : parseEnvelope(receiptBefore, installationDigest);
    const previousRevision = parseRevision(revisionBefore);
    if (receiptBefore !== null && (!previous || previousRevision === null ||
            previous.receipt.preferenceRevision !== previousRevision)) {
        rollbackDigest();
        return null;
    }
    const currentRevision = previousRevision || 0;
    if (currentRevision >= Number.MAX_SAFE_INTEGER) {
        rollbackDigest();
        return null;
    }
    const preferenceRevision = currentRevision + 1;
    const receipt = issueExplicitLocalChoiceReceipt({
        activeInstallationDigest: installationDigest,
        preferenceRevision,
        sessionPreference: preference,
        globalLanguage,
        localChoiceEvent: {
            installationDigest,
            preferenceRevision,
            surface,
            choice: 'enabled',
        },
    });
    if (!receipt) {
        rollbackDigest();
        return null;
    }
    const raw = JSON.stringify({
        schemaVersion: 1,
        scope: 'installation-local',
        receipt,
    });
    if (raw.length > MAX_RECEIPT_BYTES) {
        rollbackDigest();
        return null;
    }
    const transactionWrites = [
        [INSTALLATION_DIGEST_KEY, installationDigest],
        [PREFERENCE_REVISION_KEY, String(preferenceRevision)],
        [PREFERENCE_RECEIPT_KEY, raw],
    ];
    const rollbackTransaction = (written = transactionWrites) => restore(storage, snapshots, written);
    try {
        storage.setItem(PREFERENCE_REVISION_KEY, String(preferenceRevision));
        storage.setItem(PREFERENCE_RECEIPT_KEY, raw);
    } catch {
        rollbackTransaction();
        return null;
    }
    const digestReadback = safeGet(storage, INSTALLATION_DIGEST_KEY);
    const revisionReadback = safeGet(storage, PREFERENCE_REVISION_KEY);
    const receiptReadback = safeGet(storage, PREFERENCE_RECEIPT_KEY);
    if (digestReadback !== installationDigest ||
            revisionReadback !== String(preferenceRevision) || receiptReadback !== raw) {
        rollbackTransaction();
        return null;
    }
    const parsed = parseEnvelope(receiptReadback, installationDigest);
    const promoted = parsed && promoteStoredPreferenceReceipt({
        activeInstallationDigest: installationDigest,
        sessionPreference: preference,
        globalLanguage,
        storedReceipt: parsed.receipt,
        storageReadback: {
            scope: 'installation-local',
            installationDigest,
            preferenceRevision,
            binding: parsed.receipt.binding,
        },
    });
    if (!promoted || safeGet(storage, INSTALLATION_DIGEST_KEY) !== installationDigest ||
            safeGet(storage, PREFERENCE_REVISION_KEY) !== String(preferenceRevision) ||
            safeGet(storage, PREFERENCE_RECEIPT_KEY) !== raw) {
        rollbackTransaction();
        return null;
    }
    return promoted;
}
