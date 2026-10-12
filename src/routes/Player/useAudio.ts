// Copyright (C) 2017-2026 Smart code 203358507

import { useCallback, useEffect, useRef } from 'react';
import { languages } from 'stremio/common';
import chooseAudioTrack from './chooseAudioTrack';

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

const useAudio = ({ player, video, settings, streamStateChanged, audioPreferenceChanged }: Args) => {
    const videoRef = useRef(video);
    const trackSelectionLocked = useRef(false);
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

        const track = chooseAudioTrack(
            video.state.audioTracks,
            video.state.selectedAudioTrackId,
            player.streamState?.audioTrack,
            player.audioPreference,
            settings.audioLanguage,
            normalizeLanguage,
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
        video.state.audioTracks,
        video.state.selectedAudioTrackId,
        video.state.stream,
    ]);

    return selectTrack;
};

export default useAudio;
