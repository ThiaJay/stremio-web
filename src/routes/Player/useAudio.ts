// Copyright (C) 2017-2026 Smart code 203358507

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import enhancedSubtitlePolicy = require('./enhancedSubtitlePolicy');
import { PLAYER_STORAGE_KEYS, readPlayerSubtitleAutomation } from './intelligentSubtitles/preference-player-gate.mjs';
import { languages } from 'stremio/common';

type Args = {
    player: Player,
    video: {
        state: {
            stream: unknown | null,
            audioTracks: AudioTrack[],
            selectedAudioTrackId: string | null,
        },
        setAudioTrack: (id: string) => void,
    },
    settings: Settings,
    streamStateChanged: (state: Partial<StreamState>) => void,
    audioPreferenceChanged: (preference: AudioPreference) => void,
};

const normalizeLanguage = (language?: string | null) => {
    if (!language) {
        return undefined;
    }

    const value = language.trim();
    return (languages.find(value) ?? languages.find(value.toLowerCase()))?.code;
};

const findPreferredTrack = (
    tracks: AudioTrack[],
    selectedId: string | null,
    savedTrack: AudioTrackState | undefined,
    preference: AudioPreference | null,
    globalLanguage: string | null,
) => {
    const preferredLanguage = normalizeLanguage(preference?.language) ?? normalizeLanguage(savedTrack?.language);
    const saved = tracks.find((track) => track.id === savedTrack?.id);

    if (saved && (!preferredLanguage || normalizeLanguage(saved.lang) === preferredLanguage)) {
        return saved;
    }

    const selected = tracks.find((track) => track.id === selectedId);
    const languageOrder = [preferredLanguage, normalizeLanguage(globalLanguage)];
    for (const language of languageOrder) {
        if (!language) {
            continue;
        }

        const track = selected && normalizeLanguage(selected.lang) === language ?
            selected
            :
            tracks.find((track) => normalizeLanguage(track.lang) === language);
        if (track) {
            return track;
        }
    }

    return undefined;
};

const useAudio = ({ player, video, settings, streamStateChanged, audioPreferenceChanged }: Args) => {
    const videoRef = useRef(video);
    const trackSelectionLocked = useRef(false);
    const [enhancedOptions, setEnhancedOptions] = useState(() =>
        enhancedSubtitlePolicy.read(enhancedSubtitlePolicy.currentStorage()));
    const [enhancedStorageRevision, setEnhancedStorageRevision] = useState(0);
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const refresh = (event: StorageEvent) => {
            if (event.key === null || PLAYER_STORAGE_KEYS.includes(event.key)) {
                setEnhancedOptions(enhancedSubtitlePolicy.read(enhancedSubtitlePolicy.currentStorage()));
                setEnhancedStorageRevision((revision) => revision + 1);
            }
        };
        window.addEventListener('storage', refresh);
        return () => window.removeEventListener('storage', refresh);
    }, []);
    const enhancedAutomation = useMemo(() => readPlayerSubtitleAutomation({
        storage: enhancedSubtitlePolicy.currentStorage(),
        options: enhancedOptions,
    }), [enhancedOptions, enhancedStorageRevision]);
    const appliedTrack = useRef<string | null>(null);

    videoRef.current = video;

    const selectTrack = useCallback((id: string) => {
        const currentVideo = videoRef.current;
        const track = currentVideo.state.audioTracks.find((track) => track.id === id);
        if (!track) {
            return;
        }

        const language = normalizeLanguage(track.lang);
        trackSelectionLocked.current = true;
        appliedTrack.current = id;
        currentVideo.setAudioTrack(id);
        streamStateChanged({ audioTrack: { id, ...(language ? { language } : {}) } });
        audioPreferenceChanged(language ? { language } : {});
    }, [streamStateChanged, audioPreferenceChanged]);

    useEffect(() => {
        trackSelectionLocked.current = false;
        appliedTrack.current = null;
    }, [video.state.stream]);

    useEffect(() => {
        if (trackSelectionLocked.current || video.state.stream === null) {
            return;
        }

        const nativePreference = player.audioPreference !== null && player.audioPreference !== undefined;
        const savedPreference = !!player.streamState?.audioTrack?.id;
        const enhancedTrack = enhancedAutomation.audio && !nativePreference && !savedPreference ?
            enhancedSubtitlePolicy.preferredAudioTrack(
                video.state.audioTracks, video.state.selectedAudioTrackId, enhancedOptions, false,
            ) : null;
        const track = enhancedTrack || findPreferredTrack(
            video.state.audioTracks,
            video.state.selectedAudioTrackId,
            player.streamState?.audioTrack,
            player.audioPreference,
            settings.audioLanguage,
        );
        if (!track) {
            appliedTrack.current = null;
            return;
        }

        if (appliedTrack.current === track.id) {
            return;
        }

        videoRef.current.setAudioTrack(track.id);
        appliedTrack.current = track.id;
    }, [
        player.audioPreference,
        player.streamState,
        settings.audioLanguage,
        enhancedOptions,
        enhancedAutomation.audio,
        video.state.audioTracks,
        video.state.selectedAudioTrackId,
        video.state.stream,
    ]);

    return selectTrack;
};

export default useAudio;
