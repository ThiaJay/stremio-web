import type {
    InstallationLocalStorage,
    StoredSubtitlePreferenceProvenance,
    SubtitlePreferenceEntropySource,
} from './preference-store.mjs';
import policy = require('../enhancedSubtitlePolicy.js');

type EnhancedSubtitleOptions = ReturnType<typeof policy.normalise>;

export type SubtitleSettingsControl =
    | 'automatic-mode'
    | 'understood-primary'
    | 'understood-secondary'
    | 'subtitle-primary'
    | 'subtitle-secondary'
    | 'prefer-understood-audio'
    | 'unknown-audio'
    | 'picture-subtitles'
    | 'hearing-impaired'
    | 'forced-only'
    | 'forced-translations';

export type SubtitleSettingsWriteResult = Readonly<{
    ok: boolean;
    provenance: StoredSubtitlePreferenceProvenance | null;
    rollbackVerified: boolean;
}>;

export function commitSubtitleSettingsChoice(input: {
    storage: InstallationLocalStorage;
    randomBytes: SubtitlePreferenceEntropySource;
    currentOptions: EnhancedSubtitleOptions;
    nextOptions: EnhancedSubtitleOptions;
    localChoiceEvent: {
        surface: 'subtitle-settings';
        control: SubtitleSettingsControl;
        value: string | boolean | null;
    };
}): SubtitleSettingsWriteResult;
