import type {
    SubtitlePreferenceBinding,
    SubtitlePreferenceProvenance,
} from './preference-provenance.mjs';

const binding: SubtitlePreferenceBinding = {
    sessionEnabled: true,
    sessionLanguage: 'eng',
    globalLanguage: 'eng',
    sessionSource: null,
};

const stored: SubtitlePreferenceProvenance = {
    schemaVersion: 1,
    kind: 'same-installation-setting',
    installationDigest: 'a'.repeat(64),
    preferenceRevision: 1,
    binding,
};
const explicit: SubtitlePreferenceProvenance = {
    schemaVersion: 1,
    kind: 'explicit-local-choice',
    installationDigest: 'a'.repeat(64),
    preferenceRevision: 1,
    surface: 'first-run',
    choice: 'enabled',
    binding,
};

// @ts-expect-error explicit local evidence must identify the trusted UI surface.
const missingSurface: SubtitlePreferenceProvenance = { schemaVersion: 1, kind: 'explicit-local-choice', installationDigest: 'a'.repeat(64), preferenceRevision: 1, choice: 'enabled', binding };
// @ts-expect-error stored evidence cannot carry an explicit-choice UI claim.
const forgedStoredSurface: SubtitlePreferenceProvenance = { schemaVersion: 1, kind: 'same-installation-setting', installationDigest: 'a'.repeat(64), preferenceRevision: 1, surface: 'first-run', binding };

void [stored, explicit, missingSurface, forgedStoredSurface];
