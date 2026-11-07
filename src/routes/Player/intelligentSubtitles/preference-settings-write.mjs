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
const REQUEST_KEYS = [
    'storage', 'randomBytes', 'currentOptions', 'nextOptions', 'localChoiceEvent',
];
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
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const dataRecord = (value, keys) => {
    try {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const descriptors = Object.getOwnPropertyDescriptors(value);
        const actual = Reflect.ownKeys(descriptors);
        if (actual.length !== keys.length || keys.some((key) => !actual.includes(key)) ||
                actual.some((key) => typeof key !== 'string' || !keys.includes(key) ||
                    !descriptors[key].enumerable || !own(descriptors[key], 'value'))) return null;
        return Object.freeze(Object.fromEntries(keys.map((key) => [key, descriptors[key].value])));
    } catch {
        return null;
    }
};
const dataLanguageList = (value) => {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
        const descriptors = Object.getOwnPropertyDescriptors(value);
        const keys = Reflect.ownKeys(descriptors);
        const length = descriptors.length;
        if (!length || !own(length, 'value') || !Number.isSafeInteger(length.value) ||
                length.value < 1 || length.value > 4 || keys.length !== length.value + 1 ||
                keys.some((key) => typeof key !== 'string' ||
                    (key !== 'length' && !/^(0|[1-9][0-9]*)$/.test(key)))) return null;
        const result = [];
        for (let index = 0; index < length.value; index += 1) {
            const descriptor = descriptors[String(index)];
            if (!descriptor || !descriptor.enumerable || !own(descriptor, 'value') ||
                    typeof descriptor.value !== 'string' ||
                    !/^[a-z]{2,3}$/.test(descriptor.value)) return null;
            result.push(descriptor.value);
        }
        return Object.freeze(result);
    } catch {
        return null;
    }
};
const snapshotOptions = (value) => {
    const record = dataRecord(value, POLICY_KEYS);
    if (!record) return null;
    const understoodLanguages = dataLanguageList(record.understoodLanguages);
    const subtitleLanguages = dataLanguageList(record.subtitleLanguages);
    if (!understoodLanguages || !subtitleLanguages) return null;
    return Object.freeze({ ...record, understoodLanguages, subtitleLanguages });
};
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
    if (!value || !MODES.has(value.mode)) return false;
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

export function commitSubtitleSettingsChoice(input = {}) {
    const request = dataRecord(input, REQUEST_KEYS);
    if (!request) return rejected();
    const {
        storage, randomBytes, currentOptions, nextOptions, localChoiceEvent,
    } = request;
    const current = snapshotOptions(currentOptions);
    const next = snapshotOptions(nextOptions);
    const event = dataRecord(localChoiceEvent, EVENT_KEYS);
    if (!hasStorage(storage) || !validOptions(current) || !validOptions(next) || !event ||
            event.surface !== 'subtitle-settings' ||
            !Object.hasOwn(CONTROLS, event.control) ||
            !onlyControlChanged(current, next, event.control) ||
            !same(optionValue(next, event.control), event.value)) {
        return rejected();
    }

    const keys = [policy.STORAGE_KEY, INSTALLATION_DIGEST_KEY, PREFERENCE_RECEIPT_KEY];
    const snapshots = keys.map((key) => [key, safeGet(storage, key)]);
    if (snapshots.some(([, raw]) => raw === undefined)) return rejected();
    const storedOptions = parseStoredOptions(snapshots[0][1]);
    if (!storedOptions || !same(storedOptions, current) ||
            !snapshots.every(([key, raw]) => safeGet(storage, key) === raw)) return rejected();
    const normalized = policy.normalise(next);
    if (!same(normalized, next)) return rejected();
    const policyRaw = JSON.stringify(normalized);
    const policyWrite = [[policy.STORAGE_KEY, policyRaw]];
    const fail = (writes = policyWrite) => rejected(restore(storage, snapshots, writes));
    const readTuple = () => keys.map((key) => [key, safeGet(storage, key)]);
    const tupleMatches = (tuple, expected) => tuple.every(([key, raw]) =>
        raw !== undefined && expected.has(key) && raw === expected.get(key));
    const priorProvenance = current.mode === 'smart' || current.mode === 'on' ?
        loadStoredPreference({
            storage,
            sessionPreference: {
                enabled: true,
                language: current.subtitleLanguages[0],
            },
            globalLanguage: null,
        })
        : null;
    const snapshotTuple = new Map(snapshots);
    if (!tupleMatches(readTuple(), snapshotTuple)) return rejected();

    try {
        storage.setItem(policy.STORAGE_KEY, policyRaw);
    } catch {
        return fail();
    }
    const policyReadback = safeGet(storage, policy.STORAGE_KEY);
    if (policyReadback !== policyRaw) {
        return fail();
    }

    if (next.mode === 'off' || next.mode === 'stremio') {
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

    // A change to a subsidiary subtitle setting is not consent to turn the
    // automatic feature on. It may refresh an already verified local choice,
    // but only the automatic-mode control can originate that choice.
    if (event.control !== 'automatic-mode' && !priorProvenance) {
        const expected = new Map([
            [policy.STORAGE_KEY, policyRaw],
            [INSTALLATION_DIGEST_KEY, snapshots[1][1]],
            [PREFERENCE_RECEIPT_KEY, snapshots[2][1]],
        ]);
        if (!tupleMatches(readTuple(), expected) || !tupleMatches(readTuple(), expected)) {
            return fail();
        }
        return Object.freeze({ ok: true, provenance: null, rollbackVerified: true });
    }

    const language = next.subtitleLanguages[0];
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
