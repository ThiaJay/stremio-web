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

const POLICY_FIELDS = Object.freeze([
    'mode',
    'understoodLanguages',
    'subtitleLanguages',
    'preferUnderstoodAudio',
    'unknownAudio',
    'suspectedPictureSubtitles',
    'allowHearingImpaired',
    'allowForcedOnly',
    'forcedTranslationsForUnderstoodAudio',
]);

const sameList = (left, right) => Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length && left.every((value, index) => value === right[index]);

const samePolicy = (left, right) => left && right &&
    left.mode === right.mode &&
    sameList(left.understoodLanguages, right.understoodLanguages) &&
    sameList(left.subtitleLanguages, right.subtitleLanguages) &&
    left.preferUnderstoodAudio === right.preferUnderstoodAudio &&
    left.unknownAudio === right.unknownAudio &&
    left.suspectedPictureSubtitles === right.suspectedPictureSubtitles &&
    left.allowHearingImpaired === right.allowHearingImpaired &&
    left.allowForcedOnly === right.allowForcedOnly &&
    left.forcedTranslationsForUnderstoodAudio === right.forcedTranslationsForUnderstoodAudio;

const snapshotExactList = (candidate) => {
    try {
        if (!Array.isArray(candidate) || Object.getPrototypeOf(candidate) !== Array.prototype ||
                Object.getOwnPropertySymbols(candidate).length !== 0) return false;
        const descriptors = Object.getOwnPropertyDescriptors(candidate);
        const length = descriptors.length;
        if (!length || !Object.prototype.hasOwnProperty.call(length, 'value') ||
                !Number.isSafeInteger(length.value) || length.value < 1 || length.value > 8) return null;
        const names = Object.getOwnPropertyNames(candidate);
        const expectedNames = ['length', ...Array.from({ length: length.value }, (_, index) => String(index))];
        if (names.length !== expectedNames.length ||
                !expectedNames.every((name) => names.includes(name))) return null;
        const values = [];
        for (let index = 0; index < length.value; index += 1) {
            const descriptor = descriptors[String(index)];
            if (!descriptor || descriptor.enumerable !== true ||
                    !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
                    typeof descriptor.value !== 'string') return null;
            values.push(descriptor.value);
        }
        return Object.freeze(values);
    } catch {
        return null;
    }
};

const snapshotExactPolicy = (candidate) => {
    try {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
                Object.getPrototypeOf(candidate) !== Object.prototype ||
                Object.getOwnPropertySymbols(candidate).length !== 0) return null;
        const names = Object.getOwnPropertyNames(candidate);
        if (names.length !== POLICY_FIELDS.length ||
                !POLICY_FIELDS.every((field) => names.includes(field))) return null;
        const descriptors = Object.getOwnPropertyDescriptors(candidate);
        if (!POLICY_FIELDS.every((field) => descriptors[field]?.enumerable === true &&
                Object.prototype.hasOwnProperty.call(descriptors[field], 'value'))) return null;
        const understoodLanguages = snapshotExactList(descriptors.understoodLanguages.value);
        const subtitleLanguages = snapshotExactList(descriptors.subtitleLanguages.value);
        if (!understoodLanguages || !subtitleLanguages) return null;
        const values = Object.fromEntries(POLICY_FIELDS.map((field) => [field, descriptors[field].value]));
        if (typeof values.mode !== 'string' || typeof values.preferUnderstoodAudio !== 'boolean' ||
                typeof values.unknownAudio !== 'string' ||
                typeof values.suspectedPictureSubtitles !== 'string' ||
                typeof values.allowHearingImpaired !== 'boolean' ||
                typeof values.allowForcedOnly !== 'boolean' ||
                typeof values.forcedTranslationsForUnderstoodAudio !== 'boolean') return null;
        return Object.freeze({ ...values, understoodLanguages, subtitleLanguages });
    } catch {
        return null;
    }
};
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
            const candidate = snapshotExactPolicy(parsed);
            if (!candidate) return null;
            const normalized = policy.normalise(candidate);
            if (!samePolicy(candidate, normalized)) return null;
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
    const candidate = snapshotExactPolicy(options);
    if (!candidate) {
        return result(false, false, 'installation_preference_unverified');
    }
    const normalized = policy.normalise(candidate);
    if (!samePolicy(candidate, normalized)) {
        return result(false, false, 'installation_preference_unverified');
    }
    const before = readPlayerStoredTuple(storage);
    if (!before || !samePolicy(before.storedPolicy, normalized)) {
        return result(false, false, 'installation_preference_unverified');
    }
    if (normalized.mode === 'stremio') {
        const after = readPlayerStoredTuple(storage);
        return sameTuple(before, after) && samePolicy(after.storedPolicy, normalized) ?
            result(true, false, 'stremio_selected')
            :
            result(false, false, 'installation_preference_unverified');
    }
    if (normalized.mode === 'off') {
        const after = readPlayerStoredTuple(storage);
        return sameTuple(before, after) && samePolicy(after.storedPolicy, normalized) ?
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
    return provenance && sameTuple(before, after) && samePolicy(after.storedPolicy, normalized) ?
        result(true, true, 'installation_preference_verified', provenance)
        :
        result(false, false, 'installation_preference_unverified');
}


