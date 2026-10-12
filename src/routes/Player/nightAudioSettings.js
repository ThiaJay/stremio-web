'use strict';

// Temporary device-local settings adapter. The shared Core/player contract is
// the long-term owner. These preferences never change the physical audio route.
const STORAGE_KEY = 'stremio.nightAudio.outputProfiles.v1';
const ROUTES = Object.freeze({
    default: 'System output (not detected)',
    tv: 'TV speakers',
    soundbar: 'Soundbar',
    stereo: 'Stereo speakers',
    surround: 'Surround system',
    headphones: 'Headphones',
});
const STRENGTHS = ['gentle', 'balanced', 'strong'];
const MODES = ['off', 'always', 'scheduled'];
const CONFIGS = ['automatic', 'custom'];
const LAYOUTS = ['unknown', '2.0', '2.1', '3.1', '5.1', '7.1', 'atmos'];
const SIZES = ['unknown', 'small', 'medium', 'large'];
const SUBWOOFERS = ['unknown', 'yes', 'no'];

function timeZone() {
    try {
        const value = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (typeof value === 'string' && value) return value;
    } catch (_) { /* no timezone available */ }
    return 'Europe/London';
}

function validTime(value) {
    if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
    const h = Number(value.slice(0, 2)), m = Number(value.slice(3));
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function validZone(zone) {
    if (typeof zone !== 'string' || !zone) return false;
    try {
        new Intl.DateTimeFormat('en-GB', { timeZone: zone }).format(new Date());
        return true;
    } catch (_) {
        return false;
    }
}

function defaultProfile(zone) {
    return {
        when: 'off',
        configuration: 'automatic',
        strength: 'balanced',
        schedule: { timeZone: zone || timeZone(), windows: [{ start: '22:00', end: '07:00' }] },
        speakers: { size: 'unknown', layout: 'unknown', subwoofer: 'unknown' },
    };
}

function normaliseProfile(raw, zone) {
    const base = defaultProfile(zone);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
    const schedule = raw.schedule && typeof raw.schedule === 'object' ? raw.schedule : {};
    const windows = Array.isArray(schedule.windows) ?
        schedule.windows.filter((w) => w && validTime(w.start) && validTime(w.end) && w.start !== w.end)
            .slice(0, 4).map((w) => ({ start: w.start, end: w.end })) : [];
    const speakers = raw.speakers && typeof raw.speakers === 'object' ? raw.speakers : {};
    return {
        when: MODES.includes(raw.when) ? raw.when : base.when,
        configuration: CONFIGS.includes(raw.configuration) ? raw.configuration : base.configuration,
        strength: STRENGTHS.includes(raw.strength) ? raw.strength : base.strength,
        schedule: {
            timeZone: validZone(schedule.timeZone) ? schedule.timeZone : base.schedule.timeZone,
            windows: windows.length ? windows : base.schedule.windows,
        },
        speakers: {
            size: SIZES.includes(speakers.size) ? speakers.size : 'unknown',
            layout: LAYOUTS.includes(speakers.layout) ? speakers.layout : 'unknown',
            subwoofer: SUBWOOFERS.includes(speakers.subwoofer) ? speakers.subwoofer : 'unknown',
        },
    };
}

function emptyState() {
    return { route: 'default', profiles: {} };
}

function readState(storage) {
    let raw;
    try {
        raw = storage && storage.getItem(STORAGE_KEY);
        if (!raw || raw.length > 16000) return emptyState();
        const decoded = JSON.parse(raw);
        if (!decoded || typeof decoded !== 'object' || !decoded.profiles ||
            typeof decoded.profiles !== 'object') return emptyState();
        const profiles = {};
        for (const route of Object.keys(ROUTES)) {
            if (Object.prototype.hasOwnProperty.call(decoded.profiles, route)) {
                profiles[route] = normaliseProfile(decoded.profiles[route]);
            }
        }
        return { route: Object.prototype.hasOwnProperty.call(ROUTES, decoded.route) ?
            decoded.route : 'default', profiles };
    } catch (_) {
        return emptyState();
    }
}

function selectedProfile(state) {
    if (!state || !Object.prototype.hasOwnProperty.call(ROUTES, state.route)) {
        return defaultProfile();
    }
    return normaliseProfile(state.profiles && state.profiles[state.route]);
}

function chooseRoute(state, route) {
    if (!Object.prototype.hasOwnProperty.call(ROUTES, route)) return state;
    return { route, profiles: { ...state.profiles } };
}

function changeProfile(state, patch) {
    const selected = selectedProfile(state);
    if (!patch || typeof patch !== 'object') return state;
    const next = normaliseProfile({
        ...selected,
        ...patch,
        schedule: { ...selected.schedule, ...(patch.schedule || {}) },
        speakers: { ...selected.speakers, ...(patch.speakers || {}) },
    }, selected.schedule.timeZone);
    return {
        route: state.route,
        profiles: { ...state.profiles, [state.route]: next },
    };
}

function writeState(storage, state) {
    try {
        if (!storage || typeof storage.setItem !== 'function') return false;
        const profiles = {};
        for (const route of Object.keys(ROUTES)) {
            if (Object.prototype.hasOwnProperty.call(state.profiles || {}, route)) {
                profiles[route] = normaliseProfile(state.profiles[route]);
            }
        }
        storage.setItem(STORAGE_KEY, JSON.stringify({
            route: Object.prototype.hasOwnProperty.call(ROUTES, state.route) ? state.route : 'default',
            profiles,
        }));
        return true;
    } catch (_) {
        return false;
    }
}

module.exports = {
    STORAGE_KEY, ROUTES, STRENGTHS, MODES, CONFIGS, LAYOUTS, SIZES, SUBWOOFERS,
    defaultProfile, normaliseProfile, readState, selectedProfile, chooseRoute, changeProfile, writeState,
};
