import {
    ensureInstallationDigest,
    loadStoredPreference,
    recordExplicitLocalChoice,
    type InstallationLocalStorage,
    type StoredSubtitlePreferenceProvenance,
} from '../../src/routes/Player/intelligentSubtitles/preference-store.mjs';

const storage: InstallationLocalStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
};
const randomBytes = (length: number) => new Uint8Array(length);

const installationDigest: string | null = ensureInstallationDigest({ storage, randomBytes });
const loaded: StoredSubtitlePreferenceProvenance | null = loadStoredPreference({
    storage,
    sessionPreference: { enabled: true, language: 'eng' },
    globalLanguage: 'eng',
});
const recorded: StoredSubtitlePreferenceProvenance | null = recordExplicitLocalChoice({
    storage,
    randomBytes,
    sessionPreference: { enabled: true, language: 'eng', source: 'embedded' },
    globalLanguage: 'eng',
    surface: 'subtitle-settings',
});

// @ts-expect-error a trusted local UI surface is mandatory.
recordExplicitLocalChoice({ storage, randomBytes, sessionPreference: { enabled: true } });
// @ts-expect-error account hydration is not a trusted local UI surface.
recordExplicitLocalChoice({ storage, randomBytes, sessionPreference: { enabled: true }, surface: 'account-hydration' });
// @ts-expect-error an explicit Off state cannot issue enabled-consent evidence.
recordExplicitLocalChoice({ storage, randomBytes, sessionPreference: { enabled: false }, surface: 'first-run' });
// @ts-expect-error entropy must be opaque bytes, never an account or device identifier string.
ensureInstallationDigest({ storage, randomBytes: () => 'identity' });

void [installationDigest, loaded, recorded];
