export {};

declare global {
    type SubtitlePreference = {
        enabled: boolean;
        language?: string | null;
        source?: 'embedded' | 'external';
    };

    // Exact structural fields consumed by the existing Enhanced policy
    // declaration. These test-only globals mirror the current Player track
    // surfaces so the isolated NodeNext fixture checks the imported policy
    // declaration instead of silently skipping it.
    type AudioTrack = {
        id: string;
        lang: string;
        label?: string | null;
    };

    type SubtitleTrack = {
        id: string;
        lang: string;
        label?: string | null;
        origin?: string;
        url?: string | null;
        fallbackUrl?: string | null;
        embedded?: boolean;
        local?: boolean;
        exclusive?: boolean;
        ass?: boolean;
        buffer?: ArrayBuffer;
        forced?: boolean;
        hearingImpaired?: boolean;
    };
}
