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
const readCanonicalStoredPolicy = (storage) => {
    if (!storage || typeof storage.getItem !== 'function') return null;
    let raw;
    try {
        raw = storage.getItem(policy.STORAGE_KEY);
    } catch {
        return null;
    }
    if (raw === null) return policy.normalise(null);
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096) return null;
    try {
        const parsed = JSON.parse(raw);
        const normalized = policy.normalise(parsed);
        return same(normalized, parsed) ? normalized : null;
    } catch {
        return null;
    }
};

const result = (subtitle, audio, reason, provenance = null) => Object.freeze({
    subtitle,
    audio,
    reason,
    provenance,
});

export function readPlayerSubtitleAutomation({ storage, options } = {}) {
    const normalized = policy.normalise(options);
    if (normalized.mode === 'stremio') {
        return result(true, false, 'stremio_selected');
    }
    if (normalized.mode === 'off') {
        return result(true, false, 'subtitles_disabled');
    }

    const storedPolicy = readCanonicalStoredPolicy(storage);
    if (!storedPolicy || !same(storedPolicy, normalized)) {
        return result(false, false, 'installation_preference_unverified');
    }

    const provenance = loadStoredPreference({
        storage,
        sessionPreference: {
            enabled: true,
            language: normalized.subtitleLanguages[0],
        },
        globalLanguage: null,
    });
    return provenance ?
        result(true, true, 'installation_preference_verified', provenance)
        :
        result(false, false, 'installation_preference_unverified');
}

