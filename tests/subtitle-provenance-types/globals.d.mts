export {};

declare global {
    type SubtitlePreference = {
        enabled: boolean;
        language?: string | null;
        source?: 'embedded' | 'external';
    };
}
