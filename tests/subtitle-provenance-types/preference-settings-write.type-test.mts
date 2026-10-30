import policy = require('../../src/routes/Player/enhancedSubtitlePolicy');
import {
    commitSubtitleSettingsChoice,
    type SubtitleSettingsWriteResult,
} from '../../src/routes/Player/intelligentSubtitles/preference-settings-write.mjs';
import type { InstallationLocalStorage } from '../../src/routes/Player/intelligentSubtitles/preference-store.mjs';

const storage: InstallationLocalStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
};
const randomBytes = (length: number) => new Uint8Array(length);
const currentOptions = policy.normalise(null);
const nextOptions = policy.normalise({ ...currentOptions, mode: 'on' });

const committed: SubtitleSettingsWriteResult = commitSubtitleSettingsChoice({
    storage,
    randomBytes,
    currentOptions,
    nextOptions,
    localChoiceEvent: {
        surface: 'subtitle-settings',
        control: 'automatic-mode',
        value: 'on',
    },
});

// @ts-expect-error an actual local settings event is mandatory.
commitSubtitleSettingsChoice({ storage, randomBytes, currentOptions, nextOptions });
// @ts-expect-error account hydration is not a trusted local settings surface.
commitSubtitleSettingsChoice({ storage, randomBytes, currentOptions, nextOptions, localChoiceEvent: { surface: 'account-hydration', control: 'automatic-mode', value: 'on' } });
// @ts-expect-error arbitrary controls cannot establish consent provenance.
commitSubtitleSettingsChoice({ storage, randomBytes, currentOptions, nextOptions, localChoiceEvent: { surface: 'subtitle-settings', control: 'preferred-language-from-account', value: 'eng' } });
// @ts-expect-error entropy remains bytes, never an account or device identity string.
commitSubtitleSettingsChoice({ storage, randomBytes: () => 'identity', currentOptions, nextOptions, localChoiceEvent: { surface: 'subtitle-settings', control: 'automatic-mode', value: 'on' } });

void committed;
