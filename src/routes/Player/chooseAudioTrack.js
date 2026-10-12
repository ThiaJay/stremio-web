// Copyright (C) 2017-2026 Smart code 203358507

// Track labels are advisory. An explicit saved track is more authoritative
// than a role inferred from a provider's text label.
const ALTERNATE_AUDIO_ROLE = /\b(?:commentary|audio[ -]?description|descriptive audio|described audio|audio described|visually impaired|audiodescription|audiodescripci[oó]n|audiodeskrypcja)\b/i;

const isAlternateAudio = (track) => typeof track?.label === 'string' &&
    ALTERNATE_AUDIO_ROLE.test(track.label);

const preferPrimaryAudio = (tracks, selectedId) => {
    const selected = tracks.find((track) => track.id === selectedId);
    if (selected && !isAlternateAudio(selected)) {
        return selected;
    }

    // Only change from the backend default when a recognisable primary track
    // exists in the same language. Never discard the sole playable track.
    return tracks.find((track) => !isAlternateAudio(track)) ?? selected ?? tracks[0];
};

// Pure, read-only policy. Manual audio changes are handled and locked by the
// caller. Session language remains higher priority than the global setting.
const chooseAudioTrack = (tracks, selectedId, savedTrack, preference, globalLanguage, normalizeLanguage) => {
    if (!Array.isArray(tracks) || tracks.length === 0) {
        return undefined;
    }

    const preferredLanguage = normalizeLanguage(preference?.language) ??
        normalizeLanguage(savedTrack?.language);
    const saved = tracks.find((track) => track.id === savedTrack?.id);

    if (saved && (!preferredLanguage || normalizeLanguage(saved.lang) === preferredLanguage)) {
        return saved;
    }

    for (const language of [preferredLanguage, normalizeLanguage(globalLanguage)]) {
        if (!language) {
            continue;
        }

        const matchingTracks = tracks.filter((track) => normalizeLanguage(track.lang) === language);
        if (matchingTracks.length > 0) {
            return preferPrimaryAudio(matchingTracks, selectedId);
        }
    }

    return undefined;
};

module.exports = chooseAudioTrack;
