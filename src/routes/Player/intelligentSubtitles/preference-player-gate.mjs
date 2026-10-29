import policy from '../enhancedSubtitlePolicy.js';
import {
    INSTALLATION_DIGEST_KEY,
    PREFERENCE_RECEIPT_KEY,
    loadStoredPreference,
} from './preference-store.mjs';

export const PLAYER_STORAGE_KEYS = Object.freeze([
    policy.STORAGE_KEY,
    INSTALLATION_DIGEST_KEY,
    PREFERENCE_RECEIPT_KEY,
]);

export const PLAYER_PREFERENCE_EVENT = 'stremio-enhanced:subtitle-preference-stored-v1';

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const readPlayerStoredTuple = (storage) => {
    if (!storage || typeof storage.getItem !== 'function') return null;
    let policyRaw;
    let installationDigestRaw;
    let receiptRaw;
    try {
        policyRaw = storage.getItem(policy.STORAGE_KEY);
        installationDigestRaw = storage.getItem(INSTALLATION_DIGEST_KEY);
        receiptRaw = storage.getItem(PREFERENCE_RECEIPT_KEY);
    } catch {
        return null;
    }
    if ((installationDigestRaw !== null && typeof installationDigestRaw !== 'string') ||
            (receiptRaw !== null && typeof receiptRaw !== 'string')) return null;
    let storedPolicy;
    if (policyRaw === null) {
        storedPolicy = policy.normalise(null);
    } else if (typeof policyRaw !== 'string' || policyRaw.length === 0 || policyRaw.length > 4096) {
        return null;
    }
    try {
        if (policyRaw !== null) {
            const parsed = JSON.parse(policyRaw);
            const normalized = policy.normalise(parsed);
            if (!same(normalized, parsed)) return null;
            storedPolicy = normalized;
        }
    } catch {
        return null;
    }
    return Object.freeze({
        policyRaw,
        installationDigestRaw,
        receiptRaw,
        storedPolicy,
    });
};

const sameTuple = (left, right) => left && right &&
    left.policyRaw === right.policyRaw &&
    left.installationDigestRaw === right.installationDigestRaw &&
    left.receiptRaw === right.receiptRaw;

const result = (subtitle, audio, reason, provenance = null) => Object.freeze({
    subtitle,
    audio,
    reason,
    provenance,
});

export function readPlayerSubtitleAutomation({ storage, options } = {}) {
    const normalized = policy.normalise(options);
    if (!same(normalized, options)) {
        return result(false, false, 'installation_preference_unverified');
    }
    const before = readPlayerStoredTuple(storage);
    if (!before || !same(before.storedPolicy, normalized)) {
        return result(false, false, 'installation_preference_unverified');
    }
    if (normalized.mode === 'stremio') {
        const after = readPlayerStoredTuple(storage);
        return sameTuple(before, after) && same(after.storedPolicy, normalized) ?
            result(true, false, 'stremio_selected')
            :
            result(false, false, 'installation_preference_unverified');
    }
    if (normalized.mode === 'off') {
        const after = readPlayerStoredTuple(storage);
        return sameTuple(before, after) && same(after.storedPolicy, normalized) ?
            result(true, false, 'subtitles_disabled')
            :
            result(false, false, 'installation_preference_unverified');
    }

    const provenance = loadStoredPreference({
        storage,
        sessionPreference: {
            enabled: true,
            language: normalized.subtitleLanguages[0],
        },
        globalLanguage: null,
    });
    const after = readPlayerStoredTuple(storage);
    return provenance && sameTuple(before, after) && same(after.storedPolicy, normalized) ?
        result(true, true, 'installation_preference_verified', provenance)
        :
        result(false, false, 'installation_preference_unverified');
}

