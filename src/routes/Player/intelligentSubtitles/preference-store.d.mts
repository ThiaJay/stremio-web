import type { SubtitlePreferenceProvenance } from './preference-provenance.mjs';

export type InstallationLocalStorage = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
};
export type SubtitlePreferenceEntropySource = (length: number) => Uint8Array;
export type StoredSubtitlePreferenceProvenance = Extract<
    SubtitlePreferenceProvenance,
    { kind: 'same-installation-setting' }
>;

export const INSTALLATION_DIGEST_KEY: string;
export const PREFERENCE_RECEIPT_KEY: string;

export function ensureInstallationDigest(input: {
    storage: InstallationLocalStorage;
    randomBytes: SubtitlePreferenceEntropySource;
}): string | null;

export function loadStoredPreference(input: {
    storage: InstallationLocalStorage;
    sessionPreference?: SubtitlePreference | null;
    globalLanguage?: string | null;
}): StoredSubtitlePreferenceProvenance | null;

export function recordExplicitLocalChoice(input: {
    storage: InstallationLocalStorage;
    randomBytes: SubtitlePreferenceEntropySource;
    sessionPreference: SubtitlePreference & { enabled: true };
    globalLanguage?: string | null;
    surface: 'first-run' | 'subtitle-settings';
}): StoredSubtitlePreferenceProvenance | null;
