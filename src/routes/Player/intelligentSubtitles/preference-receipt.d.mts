import type {
    SubtitlePreferenceBinding,
    SubtitlePreferenceProvenance,
} from './preference-provenance.mjs';
type LocalChoiceEvent = {
    installationDigest: string;
    preferenceRevision: number;
    surface: 'first-run' | 'subtitle-settings';
    choice: 'enabled';
};
type StorageReadback = {
    scope: 'installation-local';
    installationDigest: string;
    preferenceRevision: number;
    binding: SubtitlePreferenceBinding;
};
export function issueExplicitLocalChoiceReceipt(input: {
    activeInstallationDigest: string;
    preferenceRevision: number;
    sessionPreference: SubtitlePreference;
    globalLanguage?: string | null;
    localChoiceEvent: LocalChoiceEvent;
}): SubtitlePreferenceProvenance | null;
export function promoteStoredPreferenceReceipt(input: {
    activeInstallationDigest: string;
    sessionPreference: SubtitlePreference;
    globalLanguage?: string | null;
    storedReceipt: SubtitlePreferenceProvenance;
    storageReadback: StorageReadback;
}): SubtitlePreferenceProvenance | null;
