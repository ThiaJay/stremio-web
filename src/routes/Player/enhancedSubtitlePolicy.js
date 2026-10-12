'use strict';

// Local Stremio Enhanced preference and decision contract. No network, account
// mutations, text recognition, stream substitution or subtitle downloads.
const STORAGE_KEY = 'stremio.enhanced.subtitlePolicy.v1';
const MODE = Object.freeze(['smart', 'off', 'on', 'stremio']);
const SUSPECTED = Object.freeze(['hold', 'ignore']);
const UNKNOWN = Object.freeze(['off', 'subtitles']);
const DEFAULT = Object.freeze({
    mode: 'smart',
    understoodLanguages: ['en'],
    subtitleLanguages: ['en'],
    preferUnderstoodAudio: true,
    unknownAudio: 'off',
    suspectedPictureSubtitles: 'hold',
    allowHearingImpaired: false,
    allowForcedOnly: false,
    forcedTranslationsForUnderstoodAudio: false,
});

const nameMap = Object.freeze({
    english: 'en', french: 'fr', spanish: 'es', german: 'de', italian: 'it',
    portuguese: 'pt', dutch: 'nl', swedish: 'sv', norwegian: 'no', danish: 'da',
    polish: 'pl', russian: 'ru', ukrainian: 'uk', arabic: 'ar', hindi: 'hi',
    japanese: 'ja', korean: 'ko', mandarin: 'zh', chinese: 'zh', cantonese: 'yue',
    turkish: 'tr', greek: 'el', czech: 'cs', romanian: 'ro', finnish: 'fi',
});
function language(value) {
    if (typeof value !== 'string') return null;
    const raw = value.trim().toLowerCase().replace(/_/g, '-');
    if (!raw || raw.length > 30 || !/^[a-z]{2,12}(?:-[a-z0-9]{2,8})*$/.test(raw)) return null;
    if (['und', 'mul', 'zxx', 'unknown', 'none', 'local'].includes(raw)) return null;
    if (nameMap[raw]) return nameMap[raw];
    try {
        const canonical = Intl.getCanonicalLocales(raw)[0];
        const primary = canonical.split('-')[0].toLowerCase();
        return /^[a-z]{2,3}$/.test(primary) && !['und', 'mul', 'zxx'].includes(primary) ? primary : null;
    } catch (_) { return null; }
}
function languagesList(value, fallback) {
    if (!Array.isArray(value)) return [...fallback];
    const result = [];
    for (const item of value.slice(0, 8)) {
        const code = language(item);
        if (code && !result.includes(code)) result.push(code);
        if (result.length >= 4) break;
    }
    return result.length ? result : [...fallback];
}
function normalise(raw) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
        mode: MODE.includes(src.mode) ? src.mode : DEFAULT.mode,
        understoodLanguages: languagesList(src.understoodLanguages, DEFAULT.understoodLanguages),
        subtitleLanguages: languagesList(src.subtitleLanguages, DEFAULT.subtitleLanguages),
        preferUnderstoodAudio: typeof src.preferUnderstoodAudio === 'boolean' ? src.preferUnderstoodAudio : DEFAULT.preferUnderstoodAudio,
        unknownAudio: UNKNOWN.includes(src.unknownAudio) ? src.unknownAudio : DEFAULT.unknownAudio,
        suspectedPictureSubtitles: SUSPECTED.includes(src.suspectedPictureSubtitles) ? src.suspectedPictureSubtitles : DEFAULT.suspectedPictureSubtitles,
        allowHearingImpaired: src.allowHearingImpaired === true,
        allowForcedOnly: src.allowForcedOnly === true,
        forcedTranslationsForUnderstoodAudio: src.forcedTranslationsForUnderstoodAudio === true,
    };
}
function read(storage) {
    try {
        const raw = storage?.getItem?.(STORAGE_KEY);
        return !raw || raw.length > 4096 ? normalise(null) : normalise(JSON.parse(raw));
    } catch (_) { return normalise(null); }
}
function save(storage, options) {
    try {
        if (!storage || typeof storage.setItem !== 'function') return false;
        storage.setItem(STORAGE_KEY, JSON.stringify(normalise(options)));
        return true;
    } catch (_) { return false; }
}
function currentStorage() {
    try { return typeof window === 'undefined' ? null : window.localStorage; }
    catch (_) { return null; }
}
function pictureEvidence({ sourceName, verifiedByViewer = false, verifiedByDecoder = false, verifiedReadableText = false, userDismissedHint = false } = {}) {
    // A decoder may identify burned text without proving its language or readability.
    if (verifiedByViewer === true || (verifiedByDecoder === true && verifiedReadableText === true)) return 'confirmed';
    if (userDismissedHint === true) return 'unknown';
    if (verifiedByDecoder === true) return 'suspected';
    // Only an advisory from potentially untrusted provider text. This is NOT
    // frame analysis or a verified observation of the picture.
    const name = typeof sourceName === 'string' ? sourceName.slice(0, 300) : '';
    return /\b(?:hard[ -]?sub(?:bed)?|hard[ -]?coded\s+sub(?:title)?s?|burn(?:ed|t)[ -]?in\s+sub(?:title)?s?)\b/i.test(name) ?
        'suspected' : 'unknown';
}
function trackFlags(track) {
    const label = typeof track?.label === 'string' ? track.label.slice(0, 140) : '';
    return {
        forced: track?.forced === true || /\bforced\b|\bsigns\s*(?:and|&)\s*songs\b/i.test(label),
        hearingImpaired: track?.hearingImpaired === true || /\bSDH\b|\bCC\b|\bhearing[ -]?impaired\b/i.test(label),
        commentary: /\bcommentary\b/i.test(label),
    };
}
function chooseSubtitleTrack(embedded, extra, prefs) {
    const candidates = [];
    for (const [source, tracks] of [['embedded', embedded], ['external', extra]]) {
        for (const track of Array.isArray(tracks) ? tracks.slice(0, 300) : []) {
            if (!track || typeof track.id !== 'string' || !track.id || !language(track.lang)) continue;
            const flags = trackFlags(track);
            if (flags.commentary || (flags.forced && !prefs.allowForcedOnly) ||
                (flags.hearingImpaired && !prefs.allowHearingImpaired)) continue;
            candidates.push({ source, id: track.id, lang: language(track.lang), flags });
        }
    }
    for (const lang of prefs.subtitleLanguages) {
        const found = candidates.find(t => t.lang === lang && !t.flags.forced && !t.flags.hearingImpaired) ||
            candidates.find(t => t.lang === lang && !t.flags.forced) ||
            candidates.find(t => t.lang === lang);
        if (found) return { source: found.source, id: found.id, language: lang };
    }
    return null;
}
function forcedTranslationTrack(embedded, extra, prefs) {
    for (const lang of prefs.subtitleLanguages) {
        for (const [source, tracks] of [['embedded', embedded], ['external', extra]]) {
            const hit = (Array.isArray(tracks) ? tracks : []).find(t =>
                typeof t?.id === 'string' && t.id && language(t.lang) === lang &&
                trackFlags(t).forced && !trackFlags(t).commentary);
            if (hit) return { source, id: hit.id, language: lang };
        }
    }
    return null;
}
function selectedAudioLanguage({ audioTracks, selectedAudioTrackId }) {
    const tracks = Array.isArray(audioTracks) ? audioTracks : [];
    const selected = tracks.find(t => t?.id === selectedAudioTrackId);
    // A single enumerated track may be used only if no contradictory selection
    // exists. More than one without an actual selected ID is unknown.
    if (selected) return language(selected.lang);
    if (selectedAudioTrackId === null && tracks.length === 1) return language(tracks[0]?.lang);
    return null;
}
function preferredAudioTrack(audioTracks, selectedAudioTrackId, prefs, manualPreference = false) {
    if (manualPreference || !prefs.preferUnderstoodAudio || prefs.mode === 'stremio') return null;
    const tracks = Array.isArray(audioTracks) ? audioTracks : [];
    for (const lang of prefs.understoodLanguages) {
        const track = tracks.find(t => typeof t?.id === 'string' && t.id && language(t.lang) === lang);
        if (track) return track;
    }
    return null;
}
function decide(input = {}) {
    const p = normalise(input.options);
    if (p.mode === 'stremio') return { action: 'inherit', reason: 'stremio_selected', picture: 'unknown' };
    if (input.manualSubtitlePreference === true) return { action: 'inherit', reason: 'manual_selection', picture: 'unknown' };
    if (input.streamReady !== true) return { action: 'hold', reason: 'waiting_for_current_media', picture: 'unknown' };
    if (p.mode === 'off') return { action: 'off', reason: 'subtitles_disabled', picture: 'unknown' };

    const picture = pictureEvidence(input.pictureEvidence);
    if (picture === 'confirmed') return { action: 'off', reason: 'picture_subtitles_confirmed', picture };
    if (picture === 'suspected' && p.suspectedPictureSubtitles === 'hold') {
        return { action: 'hold_off', reason: 'picture_subtitles_unverified', picture };
    }
    const audio = selectedAudioLanguage(input);
    if (p.mode === 'smart') {
        if (audio && p.understoodLanguages.includes(audio)) {
            if (p.forcedTranslationsForUnderstoodAudio) {
                const forced = forcedTranslationTrack(input.embeddedTracks, input.externalTracks, p);
                if (forced) return { action: 'select', reason: 'forced_translations_enabled', picture, track: forced };
            }
            return { action: 'off', reason: 'audio_understood', picture };
        }
        if (!audio && p.unknownAudio === 'off') return { action: 'off', reason: 'audio_language_unknown', picture };
        const preferred = preferredAudioTrack(input.audioTracks, input.selectedAudioTrackId, p, input.manualAudioPreference === true);
        if (preferred && input.selectedAudioTrackId !== preferred.id) {
            // The audio hook must settle on the selected understood track first.
            return { action: 'hold_off', reason: 'waiting_for_preferred_audio', picture };
        }
    }
    const track = chooseSubtitleTrack(input.embeddedTracks, input.externalTracks, p);
    if (!track) return { action: 'hold_off', reason: 'no_matching_subtitle_track', picture };
    return { action: 'select', reason: 'subtitle_language_required', picture, track };
}
module.exports = {
    STORAGE_KEY, DEFAULT, MODE, UNKNOWN, SUSPECTED, language, normalise, read, save,
    currentStorage, pictureEvidence, trackFlags, chooseSubtitleTrack,
    selectedAudioLanguage, preferredAudioTrack, forcedTranslationTrack, decide,
};
