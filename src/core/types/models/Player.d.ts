type LibraryItemPlayer = Pick<LibraryItem, '_id'> & {
    state: Pick<LibraryItemState, 'timeOffset' | 'video_id'>,
};

type VideoPlayer = Video & {
    upcoming: boolean,
    watched: boolean,
    scheduled: boolean,
    deepLinks: VideoDeepLinks,
};

type MetaItemPlayer = MetaItemPreview & {
    videos: VideoPlayer[],
};

type SelectedStream = Stream & {
    deepLinks: StreamDeepLinks,
    subtitles?: Subtitle[],
};

type Subtitle = {
    id: string,
    lang: string,
    origin?: string,
    url?: string | null,
    fallbackUrl?: string | null,
    label?: string | null,
};

type SeriesInfo = {
    episode: number,
    season: number,
};

type SubtitlesTrackState = {
    id: string,
    embedded: boolean,
    language?: string,
};

type AudioTrackState = {
    id: string,
    language?: string,
};

type AudioPreference = {
    language?: string,
};

type AvSyncCorrection = 'soft' | 'hard';

type AvSyncStatus = 'stable' | 'monitoring' | 'correcting' | 'uncorrectable';

type AvSyncObservation = {
    offsetMs: number,
    buffering?: boolean,
    seeking?: boolean,
    refreshRateSwitching?: boolean,
    canSoftCorrect?: boolean,
    canHardCorrect?: boolean,
};

type AvSyncState = {
    offsetMs: number,
    status: AvSyncStatus,
    correction?: AvSyncCorrection,
    generation: number,
};

type PlaybackRecoveryAction = 'transcodeAudio' | 'switchPlaybackEngine' | 'restoreStableVideoAndTranscodeAudio' | 'switchStream';

type PlaybackHealthStatus = 'healthy' | 'monitoring' | 'recovering' | 'exhausted';

type PlaybackHealthObservation = {
    engine?: string,
    audioCodec?: string,
    audioExpected?: boolean,
    audioPresent?: boolean,
    videoStable?: boolean,
    transient?: boolean,
    canTranscodeAudio?: boolean,
    canSwitchEngine?: boolean,
    canRestoreStableVideo?: boolean,
    canSwitchStream?: boolean,
};

type PlaybackHealthState = {
    status: PlaybackHealthStatus,
    recovery?: PlaybackRecoveryAction,
    generation: number,
    engine?: string,
    audioCodec?: string,
};

type VideoScale = 'contain' | 'cover' | 'fill';

type IntroData = {
    from: number,
    to: number,
    duration: number | null,
};

type IntroOutro = {
    intro: IntroData | null,
    outro: number | null,
};

type SkipSegmentKind = 'intro' | 'recap' | 'outro' | 'preview';

type SkipSegmentState = {
    kind: SkipSegmentKind,
    generation: number,
    videoId: string,
    from: number,
    to: number,
    duration: number,
    mode: 'ask' | 'always' | 'never',
    active: boolean,
    dismissed: boolean,
    seekTo: number | null,
};

type SubtitleSource = 'embedded' | 'external';

type SubtitlePreference = {
    enabled: boolean,
    source?: SubtitleSource,
    language?: string,
};

type StreamState = {
    subtitleTrack?: SubtitlesTrackState | null,
    subtitleDelay?: number,
    subtitleSize?: number,
    subtitleOffset?: number,
    audioTrack?: AudioTrackState,
    videoScale?: VideoScale,
};

type Player = {
    addon: Addon | null,
    libraryItem: LibraryItemPlayer | null,
    metaItem: Loadable<MetaItemPlayer> | null,
    nextVideo: VideoPlayer | null,
    selected: {
        stream: SelectedStream,
        metaRequest: ResourceRequest,
        streamRequest: ResourceRequest,
        subtitlesPath: ResourceRequestPath,
    } | null,
    stream: Loadable<SelectedStream> | null,
    seriesInfo: SeriesInfo | null,
    streamState: StreamState | null,
    audioPreference: AudioPreference | null,
    subtitlePreference: SubtitlePreference | null,
    videoScale: VideoScale | null,
    avSync: AvSyncState,
    playbackHealth: PlaybackHealthState,
    introOutro: IntroOutro | null,
    skipSegment: SkipSegmentState | null,
    skipIntro?: SkipSegmentState | null,
    subtitles: Subtitle[],
    title: string | null,
};
