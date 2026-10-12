// Unofficial Stremio Enhanced local presentation policy.
// This cannot create, change or authorise a Stremio Core skip segment.
'use strict';

const STORAGE_KEY = 'stremio.enhanced.skipModes.v1';
const MAX_STORAGE_LENGTH = 1024;
const MODES = Object.freeze(['inherit', 'ask', 'always', 'never']);
const KINDS = Object.freeze(['intro', 'recap', 'outro']);
const BASE_MODES = Object.freeze(['ask', 'always', 'never']);

function defaultState() {
    return { schema: 1, intro: 'inherit', recap: 'inherit', outro: 'inherit' };
}

function normaliseState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.schema !== 1) return null;
    const allowed = new Set(['schema', ...KINDS]);
    if (Object.keys(value).some((key) => !allowed.has(key))) return null;
    const next = defaultState();
    for (const kind of KINDS) {
        if (value[kind] !== undefined) {
            if (!MODES.includes(value[kind])) return null;
            next[kind] = value[kind];
        }
    }
    return next;
}

function readState(storage) {
    try {
        if (!storage || typeof storage.getItem !== 'function') return defaultState();
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw || typeof raw !== 'string' || raw.length > MAX_STORAGE_LENGTH) return defaultState();
        return normaliseState(JSON.parse(raw)) || defaultState();
    } catch (_) {
        return defaultState();
    }
}

function updateMode(current, kind, mode) {
    if (!KINDS.includes(kind) || !MODES.includes(mode)) throw new Error('INVALID_ENHANCED_SKIP_MODE');
    const state = normaliseState(current);
    if (!state) throw new Error('INVALID_ENHANCED_SKIP_STATE');
    return { ...state, [kind]: mode };
}

function writeState(storage, state) {
    const validated = normaliseState(state);
    if (!validated || !storage || typeof storage.setItem !== 'function' || typeof storage.getItem !== 'function') return false;
    try {
        const raw = JSON.stringify(validated);
        if (raw.length > MAX_STORAGE_LENGTH) return false;
        storage.setItem(STORAGE_KEY, raw);
        return storage.getItem(STORAGE_KEY) === raw;
    } catch (_) {
        return false;
    }
}

// The authoritative Core segment must exist and match Core's account-level mode.
// A device-local mode cannot reverse a Core-level 'never' decision or grant
// access to native paid Skip Gaps data. It only decides whether an already
// resolved, actionable segment is offered, ignored or automatically acted on.
function resolveMode({ segment, inheritedMode, overrides } = {}) {
    if (!segment || !KINDS.includes(segment.kind) || !BASE_MODES.includes(inheritedMode) ||
        segment.mode !== inheritedMode || inheritedMode === 'never') return 'never';
    const safe = normaliseState(overrides);
    if (!safe) return 'never';
    const value = safe[segment.kind];
    const desired = value === 'inherit' ? inheritedMode : value;
    // Credits targeting the media end can trigger client completion/navigation.
    // Never add an automatic terminal seek solely because of a local override.
    if (segment.kind === 'outro' && value === 'always') {
        if (!Number.isSafeInteger(segment.duration) || segment.duration <= 0 ||
            !Number.isSafeInteger(segment.to) || segment.to <= 0) return 'never';
        if (segment.to >= segment.duration - 1000) return 'ask';
    }
    return desired;
}

module.exports = { STORAGE_KEY, KINDS, MODES, defaultState, normaliseState, readState, updateMode, writeState, resolveMode };
