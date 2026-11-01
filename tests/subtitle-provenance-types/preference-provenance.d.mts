export type SubtitlePreferenceBinding = {
    sessionEnabled: boolean | null;
    sessionLanguage: string | null;
    globalLanguage: string | null;
    sessionSource: 'embedded' | 'external' | null;
};
type SubtitlePreferenceProvenanceBase = {
    schemaVersion: 1;
    installationDigest: string;
    preferenceRevision: number;
    binding: SubtitlePreferenceBinding;
};
export type SubtitlePreferenceProvenance =
    | (SubtitlePreferenceProvenanceBase & {
        kind: 'same-installation-setting';
    })
    | (SubtitlePreferenceProvenanceBase & {
        kind: 'explicit-local-choice';
        surface: 'first-run' | 'subtitle-settings';
        choice: 'enabled';
    });
export function preferenceBinding(input: {
    sessionPreference?: SubtitlePreference | null;
    globalLanguage?: string | null;
}): SubtitlePreferenceBinding;
export function verifySubtitlePreferenceProvenance(input: {
    sessionPreference?: SubtitlePreference | null;
    globalLanguage?: string | null;
    preferenceProvenance?: SubtitlePreferenceProvenance | null;
    activeInstallationDigest?: string | null;
}): boolean;
export function needsSubtitlePreferenceChoice(input: {
    sessionPreference?: SubtitlePreference | null;
    globalLanguage?: string | null;
    preferenceProvenance?: SubtitlePreferenceProvenance | null;
    activeInstallationDigest?: string | null;
}): boolean;
