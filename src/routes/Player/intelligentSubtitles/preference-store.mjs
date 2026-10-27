import { verifySubtitlePreferenceProvenance } from './preference-provenance.mjs';
import {
    issueExplicitLocalChoiceReceipt,
    promoteStoredPreferenceReceipt,
} from './preference-receipt.mjs';

export const INSTALLATION_DIGEST_KEY = 'stremio-enhanced.subtitle-provenance.installation.v1';
export const PREFERENCE_RECEIPT_KEY = 'stremio-enhanced.subtitle-provenance.receipt.v1';

const DIGEST = /^[0-9a-f]{64}$/;
const MAX_RECEIPT_BYTES = 4096;
const SURFACES = new Set(['first-run', 'subtitle-settings']);
const ENVELOPE_KEYS = ['schemaVersion', 'scope', 'receipt'];
const RECEIPT_KEYS = [
    'schemaVersion', 'kind', 'installationDigest', 'preferenceRevision',
    'surface', 'choice', 'binding',
];
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

const bytesToDigest = (bytes) => {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 32) return null;
    return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
};

const restore = (storage, snapshots) => {
    try {
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
        preferenceProvenance: receipt,
    })) return null;
    return Object.freeze({ envelope, receipt });
};

const readInstallationDigest = (storage) => {
    const raw = safeGet(storage, INSTALLATION_DIGEST_KEY);
    return DIGEST.test(raw || '') ? raw : null;
};

export function ensureInstallationDigest({ storage, randomBytes } = {}) {
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
        restore(storage, [[INSTALLATION_DIGEST_KEY, before]]);
        return null;
    }
    if (safeGet(storage, INSTALLATION_DIGEST_KEY) !== generated) {
        restore(storage, [[INSTALLATION_DIGEST_KEY, before]]);
        return null;
    }
    return generated;
}

export function loadStoredPreference({ storage, sessionPreference, globalLanguage } = {}) {
    if (!hasStorage(storage)) return null;
    const installationDigest = readInstallationDigest(storage);
    if (!installationDigest) return null;
    const parsed = parseEnvelope(safeGet(storage, PREFERENCE_RECEIPT_KEY), installationDigest);
    if (!parsed) return null;
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

export function recordExplicitLocalChoice({
    storage, randomBytes, sessionPreference, globalLanguage, surface,
} = {}) {
    if (!hasStorage(storage) || !SURFACES.has(surface) || sessionPreference?.enabled !== true) return null;
    const digestBefore = safeGet(storage, INSTALLATION_DIGEST_KEY);
    const receiptBefore = safeGet(storage, PREFERENCE_RECEIPT_KEY);
    if (digestBefore === undefined || receiptBefore === undefined) return null;
    const snapshots = [
        [INSTALLATION_DIGEST_KEY, digestBefore],
        [PREFERENCE_RECEIPT_KEY, receiptBefore],
    ];
    if (digestBefore === null && receiptBefore !== null) return null;
    const installationDigest = ensureInstallationDigest({ storage, randomBytes });
    if (!installationDigest) return null;
    const previous = receiptBefore === null ? null : parseEnvelope(receiptBefore, installationDigest);
    if (receiptBefore !== null && !previous) {
        restore(storage, snapshots);
        return null;
    }
    const previousRevision = previous?.receipt.preferenceRevision || 0;
    if (previousRevision >= Number.MAX_SAFE_INTEGER) {
        restore(storage, snapshots);
        return null;
    }
    const preferenceRevision = previousRevision + 1;
    const receipt = issueExplicitLocalChoiceReceipt({
        activeInstallationDigest: installationDigest,
        preferenceRevision,
        sessionPreference,
        globalLanguage,
        localChoiceEvent: {
            installationDigest,
            preferenceRevision,
            surface,
            choice: 'enabled',
        },
    });
    if (!receipt) {
        restore(storage, snapshots);
        return null;
    }
    const raw = JSON.stringify({
        schemaVersion: 1,
        scope: 'installation-local',
        receipt,
    });
    if (raw.length > MAX_RECEIPT_BYTES) {
        restore(storage, snapshots);
        return null;
    }
    try {
        storage.setItem(PREFERENCE_RECEIPT_KEY, raw);
    } catch {
        restore(storage, snapshots);
        return null;
    }
    const readback = safeGet(storage, PREFERENCE_RECEIPT_KEY);
    const parsed = readback === raw ? parseEnvelope(readback, installationDigest) : null;
    const promoted = parsed && promoteStoredPreferenceReceipt({
        activeInstallationDigest: installationDigest,
        sessionPreference,
        globalLanguage,
        storedReceipt: parsed.receipt,
        storageReadback: {
            scope: 'installation-local',
            installationDigest,
            preferenceRevision,
            binding: parsed.receipt.binding,
        },
    });
    if (!promoted) {
        restore(storage, snapshots);
        return null;
    }
    return promoted;
}
