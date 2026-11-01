import type { StoredSubtitlePreferenceProvenance, InstallationLocalStorage } from './preference-store.mjs';

export type PlayerSubtitleAutomationGate = Readonly<{
    subtitle: boolean;
    audio: boolean;
    reason: 'stremio_selected' | 'subtitles_disabled' |
        'installation_preference_verified' | 'installation_preference_unverified';
    provenance: StoredSubtitlePreferenceProvenance | null;
}>;

export const PLAYER_STORAGE_KEYS: readonly string[];

export function readPlayerSubtitleAutomation(input?: {
    storage?: InstallationLocalStorage | null;
    options?: unknown;
}): PlayerSubtitleAutomationGate;
