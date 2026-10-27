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
