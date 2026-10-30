import policy from '../enhancedSubtitlePolicy.js';
import {
    INSTALLATION_DIGEST_KEY,
    PREFERENCE_RECEIPT_KEY,
    loadStoredPreference,
    recordExplicitLocalChoice,
} from './preference-store.mjs';

const POLICY_KEYS = [
    'mode', 'understoodLanguages', 'subtitleLanguages', 'preferUnderstoodAudio',
    'unknownAudio', 'suspectedPictureSubtitles', 'allowHearingImpaired',
    'allowForcedOnly', 'forcedTranslationsForUnderstoodAudio',
];
const EVENT_KEYS = ['surface', 'control', 'value'];
const MODES = new Set(['smart', 'off', 'on', 'stremio']);
const CONTROLS = Object.freeze({
    'automatic-mode': 'mode',
    'understood-primary': 'understoodLanguages',
    'understood-secondary': 'understoodLanguages',
    'subtitle-primary': 'subtitleLanguages',
    'subtitle-secondary': 'subtitleLanguages',
    'prefer-understood-audio': 'preferUnderstoodAudio',
    'unknown-audio': 'unknownAudio',
    'picture-subtitles': 'suspectedPictureSubtitles',
    'hearing-impaired': 'allowHearingImpaired',
    'forced-only': 'allowForcedOnly',
    'forced-translations': 'forcedTranslationsForUnderstoodAudio',
});
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
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const optionValue = (options, control) => {
    switch (control) {
        case 'automatic-mode': return options.mode;
        case 'understood-primary': return options.understoodLanguages[0] || null;
        case 'understood-secondary': return options.understoodLanguages[1] || null;
        case 'subtitle-primary': return options.subtitleLanguages[0] || null;
        case 'subtitle-secondary': return options.subtitleLanguages[1] || null;
        case 'prefer-understood-audio': return options.preferUnderstoodAudio;
        case 'unknown-audio': return options.unknownAudio;
        case 'picture-subtitles': return options.suspectedPictureSubtitles;
        case 'hearing-impaired': return options.allowHearingImpaired;
        case 'forced-only': return options.allowForcedOnly;
        case 'forced-translations': return options.forcedTranslationsForUnderstoodAudio;
        default: return undefined;
    }
};
const validOptions = (value) => {
    if (!exactKeys(value, POLICY_KEYS) || !MODES.has(value.mode)) return false;
    if (!Array.isArray(value.understoodLanguages) || !Array.isArray(value.subtitleLanguages) ||
            value.understoodLanguages.length < 1 || value.understoodLanguages.length > 4 ||
            value.subtitleLanguages.length < 1 || value.subtitleLanguages.length > 4) return false;
    if (![...value.understoodLanguages, ...value.subtitleLanguages].every(
        (item) => typeof item === 'string' && /^[a-z]{2,3}$/.test(item))) return false;
    return typeof value.preferUnderstoodAudio === 'boolean' &&
        ['off', 'subtitles'].includes(value.unknownAudio) &&
        ['hold', 'ignore'].includes(value.suspectedPictureSubtitles) &&
        typeof value.allowHearingImpaired === 'boolean' &&
        typeof value.allowForcedOnly === 'boolean' &&
        typeof value.forcedTranslationsForUnderstoodAudio === 'boolean';
};
const onlyControlChanged = (before, after, control) => {
    const field = CONTROLS[control];
    if (!field) return false;
    return POLICY_KEYS.every((key) => key === field || same(before[key], after[key]));
};
const parseStoredOptions = (raw) => {
    if (raw === null) return policy.normalise(null);
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096) return null;
    try {
        const parsed = JSON.parse(raw);
        return validOptions(parsed) && same(policy.normalise(parsed), parsed) ? parsed : null;
    } catch {
        return null;
    }
};
// Rollback owns only exact values written by this transaction. Any unknown
// policy, identity or receipt drift belongs to another browser context and
// must be preserved rather than replaced with a stale snapshot.
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
const rejected = (rollbackVerified = true) => Object.freeze({
    ok: false,
    provenance: null,
    rollbackVerified,
});

export function commitSubtitleSettingsChoice({
    storage, randomBytes, currentOptions, nextOptions, localChoiceEvent,
} = {}) {
    if (!hasStorage(storage) || !validOptions(currentOptions) || !validOptions(nextOptions) ||
            !exactKeys(localChoiceEvent, EVENT_KEYS) ||
            localChoiceEvent.surface !== 'subtitle-settings' ||
            !Object.hasOwn(CONTROLS, localChoiceEvent.control) ||
            !onlyControlChanged(currentOptions, nextOptions, localChoiceEvent.control) ||
            !same(optionValue(nextOptions, localChoiceEvent.control), localChoiceEvent.value)) {
        return rejected();
    }

    const keys = [policy.STORAGE_KEY, INSTALLATION_DIGEST_KEY, PREFERENCE_RECEIPT_KEY];
    const snapshots = keys.map((key) => [key, safeGet(storage, key)]);
    if (snapshots.some(([, raw]) => raw === undefined)) return rejected();
    const storedOptions = parseStoredOptions(snapshots[0][1]);
    if (!storedOptions || !same(storedOptions, currentOptions) ||
            !snapshots.every(([key, raw]) => safeGet(storage, key) === raw)) return rejected();
    const normalized = policy.normalise(nextOptions);
    if (!same(normalized, nextOptions)) return rejected();
    const policyRaw = JSON.stringify(normalized);
    const policyWrite = [[policy.STORAGE_KEY, policyRaw]];
    const fail = (writes = policyWrite) => rejected(restore(storage, snapshots, writes));
    const readTuple = () => keys.map((key) => [key, safeGet(storage, key)]);
    const tupleMatches = (tuple, expected) => tuple.every(([key, raw]) =>
        raw !== undefined && expected.has(key) && raw === expected.get(key));

    try {
        storage.setItem(policy.STORAGE_KEY, policyRaw);
    } catch {
        return fail();
    }
    const policyReadback = safeGet(storage, policy.STORAGE_KEY);
    if (policyReadback !== policyRaw) {
        return fail(policyReadback === undefined ? policyWrite : [[policy.STORAGE_KEY, policyReadback]]);
    }

    if (nextOptions.mode === 'off' || nextOptions.mode === 'stremio') {
        const transactionWrites = [
            [policy.STORAGE_KEY, policyRaw],
            [PREFERENCE_RECEIPT_KEY, null],
        ];
        try {
            storage.removeItem(PREFERENCE_RECEIPT_KEY);
        } catch {
            return fail(transactionWrites);
        }
        const expected = new Map([
            [policy.STORAGE_KEY, policyRaw],
            [INSTALLATION_DIGEST_KEY, snapshots[1][1]],
            [PREFERENCE_RECEIPT_KEY, null],
        ]);
        if (!tupleMatches(readTuple(), expected) || !tupleMatches(readTuple(), expected)) {
            return fail(transactionWrites);
        }
        return Object.freeze({ ok: true, provenance: null, rollbackVerified: true });
    }

    const language = nextOptions.subtitleLanguages[0];
    const provenance = recordExplicitLocalChoice({
        storage,
        randomBytes,
        sessionPreference: { enabled: true, language },
        globalLanguage: null,
        surface: 'subtitle-settings',
    });
    if (!provenance) return fail();

    const receiptRaw = JSON.stringify({
        schemaVersion: 1,
        scope: 'installation-local',
        receipt: {
            schemaVersion: 1,
            kind: 'explicit-local-choice',
            installationDigest: provenance.installationDigest,
            preferenceRevision: provenance.preferenceRevision,
            surface: 'subtitle-settings',
            choice: 'enabled',
            binding: provenance.binding,
        },
    });
    const transactionWrites = [
        [policy.STORAGE_KEY, policyRaw],
        [INSTALLATION_DIGEST_KEY, provenance.installationDigest],
        [PREFERENCE_RECEIPT_KEY, receiptRaw],
    ];
    const expected = new Map(transactionWrites);
    if (!tupleMatches(readTuple(), expected)) return fail(transactionWrites);
    const reloaded = loadStoredPreference({
        storage,
        sessionPreference: { enabled: true, language },
        globalLanguage: null,
    });
    if (!same(reloaded, provenance) || !tupleMatches(readTuple(), expected)) {
        return fail(transactionWrites);
    }
    return Object.freeze({ ok: true, provenance, rollbackVerified: true });
}
