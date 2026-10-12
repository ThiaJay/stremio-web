type EnhancedSubtitleOptions = {
    mode: 'smart' | 'off' | 'on' | 'stremio';
    understoodLanguages: string[];
    subtitleLanguages: string[];
    preferUnderstoodAudio: boolean;
    unknownAudio: 'off' | 'subtitles';
    suspectedPictureSubtitles: 'hold' | 'ignore';
    allowHearingImpaired: boolean;
    allowForcedOnly: boolean;
    forcedTranslationsForUnderstoodAudio: boolean;
};
type EnhancedSubtitleDecision = {
    action: 'inherit' | 'off' | 'hold' | 'hold_off' | 'select';
    reason: string;
    picture: 'unknown' | 'suspected' | 'confirmed';
    track?: { id: string; source: 'embedded' | 'external'; language: string };
};
declare const subtitlePolicy: {
    STORAGE_KEY: string;
    DEFAULT: EnhancedSubtitleOptions;
    language: (value: unknown) => string | null;
    normalise: (settings: unknown) => EnhancedSubtitleOptions;
    read: (storage: Storage | null) => EnhancedSubtitleOptions;
    save: (storage: Storage | null, settings: unknown) => boolean;
    currentStorage: () => Storage | null;
    pictureEvidence: (evidence?: unknown) => 'unknown' | 'suspected' | 'confirmed';
    preferredAudioTrack: (tracks: AudioTrack[], id: string | null, preferences: EnhancedSubtitleOptions, manual?: boolean) => AudioTrack | null;
    decide: (input?: {
        options?: EnhancedSubtitleOptions;
        streamReady?: boolean;
        manualSubtitlePreference?: boolean;
        manualAudioPreference?: boolean;
        audioTracks?: AudioTrack[];
        selectedAudioTrackId?: string | null;
        embeddedTracks?: SubtitleTrack[];
        externalTracks?: SubtitleTrack[];
        pictureEvidence?: { sourceName?: string; verifiedByViewer?: boolean; verifiedByDecoder?: boolean; verifiedReadableText?: boolean; userDismissedHint?: boolean };
    }) => EnhancedSubtitleDecision;
};
export = subtitlePolicy;
