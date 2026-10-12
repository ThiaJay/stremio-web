import React, { useMemo, useState } from 'react';
import { MultiselectMenu, Toggle } from 'stremio/components';
import { languageNames } from 'stremio/common';
import { Option } from '../components';
import policy = require('../../Player/enhancedSubtitlePolicy');

// Unlike Stremio Core account settings these choices remain on this device.
// Automatic subtitle decisions never persist the current video's track in the account.
const EnhancedSubtitlePreferences = () => {
    const [values, setValues] = useState(() => policy.read(policy.currentStorage()));
    const [saved, setSaved] = useState(true);
    const languageOptions = useMemo(() => {
        const seen = new Set<string>();
        const options: { value: string, label: string }[] = [];
        for (const [key, label] of Object.entries(languageNames as Record<string, string>)) {
            const code = policy.language(key);
            if (!code || seen.has(code)) continue;
            seen.add(code);
            options.push({ value: code, label });
        }
        options.sort((a, b) => a.label.localeCompare(b.label));
        return options;
    }, []);
    const apply = (patch: Record<string, unknown>) => {
        const next = policy.normalise({ ...values, ...patch });
        setValues(next);
        setSaved(policy.save(policy.currentStorage(), next));
    };
    const audio = values.understoodLanguages;
    const subtitles = values.subtitleLanguages;
    const optionalLanguages = [{ value: 'none', label: 'None' }, ...languageOptions];
    const menus = {
        mode: {
            options: [
                { value: 'smart', label: 'Smart, normally off' },
                { value: 'off', label: 'Always off' },
                { value: 'on', label: 'Always on when available' },
                { value: 'stremio', label: 'Use original Stremio settings' },
            ],
            value: values.mode,
            onSelect: (value: string) => apply({ mode: value }),
        },
        firstAudio: {
            options: languageOptions,
            value: audio[0] || 'en',
            onSelect: (value: string) => apply({ understoodLanguages: [value, ...audio.slice(1).filter((a: string) => a !== value)] }),
        },
        secondAudio: {
            options: optionalLanguages,
            value: audio[1] || 'none',
            onSelect: (value: string) => apply({ understoodLanguages: value === 'none' ? [audio[0]] : [audio[0], value] }),
        },
        firstSubtitle: {
            options: languageOptions,
            value: subtitles[0] || 'en',
            onSelect: (value: string) => apply({ subtitleLanguages: [value, ...subtitles.slice(1).filter((s: string) => s !== value)] }),
        },
        secondSubtitle: {
            options: optionalLanguages,
            value: subtitles[1] || 'none',
            onSelect: (value: string) => apply({ subtitleLanguages: value === 'none' ? [subtitles[0]] : [subtitles[0], value] }),
        },
        unknownAudio: {
            options: [
                { value: 'off', label: 'Leave subtitles off until the language is known' },
                { value: 'subtitles', label: 'Use my preferred subtitles when language is unknown' },
            ],
            value: values.unknownAudio,
            onSelect: (value: string) => apply({ unknownAudio: value }),
        },
        picture: {
            options: [
                { value: 'hold', label: 'Avoid a duplicate and let me decide' },
                { value: 'ignore', label: 'Use normal automatic selection' },
            ],
            value: values.suspectedPictureSubtitles,
            onSelect: (value: string) => apply({ suspectedPictureSubtitles: value }),
        },
    };
    return (
        <>
            <Option label={'Enhanced automatic subtitles'} labelDefault={'Enhanced automatic subtitles'}>
                <MultiselectMenu {...menus.mode} />
            </Option>
            <Option label={'First language I understand'} labelDefault={'First language I understand'}>
                <MultiselectMenu {...menus.firstAudio} />
            </Option>
            <Option label={'Second language I understand'} labelDefault={'Second language I understand'}>
                <MultiselectMenu {...menus.secondAudio} />
            </Option>
            <Option label={'Preferred subtitle language'} labelDefault={'Preferred subtitle language'}>
                <MultiselectMenu {...menus.firstSubtitle} />
            </Option>
            <Option label={'Second subtitle language'} labelDefault={'Second subtitle language'}>
                <MultiselectMenu {...menus.secondSubtitle} />
            </Option>
            <Option label={'Prefer spoken audio I understand'} labelDefault={'Prefer spoken audio I understand'}>
                <Toggle checked={values.preferUnderstoodAudio} onClick={() => apply({ preferUnderstoodAudio: !values.preferUnderstoodAudio })} />
            </Option>
            <Option label={'Unknown audio language'} labelDefault={'Unknown audio language'}>
                <MultiselectMenu {...menus.unknownAudio} />
            </Option>
            <Option label={'Possible subtitles embedded in the picture'} labelDefault={'Possible subtitles embedded in the picture'}>
                <MultiselectMenu {...menus.picture} />
            </Option>
            <Option label={'Allow hearing impaired captions as a fallback'} labelDefault={'Allow hearing impaired captions as a fallback'}>
                <Toggle checked={values.allowHearingImpaired} onClick={() => apply({ allowHearingImpaired: !values.allowHearingImpaired })} />
            </Option>
            <Option label={'Allow forced or partial subtitles as a fallback'} labelDefault={'Allow forced or partial subtitles as a fallback'}>
                <Toggle checked={values.allowForcedOnly} onClick={() => apply({ allowForcedOnly: !values.allowForcedOnly })} />
            </Option>
            <Option label={'Show forced translations in understood audio'} labelDefault={'Show forced translations in understood audio'}>
                <Toggle checked={values.forcedTranslationsForUnderstoodAudio} onClick={() => apply({ forcedTranslationsForUnderstoodAudio: !values.forcedTranslationsForUnderstoodAudio })} />
            </Option>
            {!saved && <p role="alert">These preferences could not be saved on this device. The current session will keep them.</p>}
            <p>Picture subtitle detection is advisory unless you confirm the text is visible. Automatic selection does not change watched history.</p>
        </>
    );
};

export default EnhancedSubtitlePreferences;
