import React, { useCallback, useMemo, useState } from 'react';
import { MultiselectMenu } from 'stremio/components';
import { Option } from '../components';
import * as enhancedSkipModes from '../../Player/enhancedSkipModes';
import type { EnhancedSkipKind, EnhancedSkipMode } from '../../Player/enhancedSkipModes';

// These are presentation preferences, never Stremio account settings.
const LABELS: Record<EnhancedSkipKind, string> = {
    intro: 'Introductions', recap: 'Recaps', outro: 'Credits',
};
const VALUE_LABELS: Record<EnhancedSkipMode, string> = {
    inherit: 'Use main Stremio setting', ask: 'Ask before skipping',
    always: 'Skip automatically', never: 'Never skip',
};
function getLocalStorage(): Storage | null {
    try { return typeof window === 'undefined' ? null : window.localStorage; }
    catch { return null; }
}

const EnhancedSkipPreferences = () => {
    const [preferences, setPreferences] = useState(() => enhancedSkipModes.readState(getLocalStorage()));
    const [message, setMessage] = useState('');
    const options = useMemo(() => enhancedSkipModes.MODES.map((value) => ({value, label: VALUE_LABELS[value]})), []);
    const selectMode = useCallback((kind: EnhancedSkipKind, value: EnhancedSkipMode) => {
        try {
            const next = enhancedSkipModes.updateMode(preferences, kind, value);
            if (!enhancedSkipModes.writeState(getLocalStorage(), next)) {
                setMessage('This browser could not verify saving that preference. Review it before relying on it.');
                return;
            }
            setPreferences(next);
            setMessage(`${LABELS[kind]} preference saved only on this device.`);
        } catch {
            setMessage('That preference was not accepted. No change was saved.');
        }
    }, [preferences]);

    return (
        <>
            <Option label={'ENHANCED_SKIP_HELP'} labelDefault={'Individual skip choices apply only to valid Stremio Core segments. The main Skip setting must not be Never. These choices stay on this device.'}>
                <span role={'note'}>{'Official Skip Gaps entitlements and the selected video remain unchanged.'}</span>
            </Option>
            {enhancedSkipModes.KINDS.map((kind) => (
                <Option key={kind} label={`ENHANCED_SKIP_${kind.toUpperCase()}`} labelDefault={`Enhanced ${LABELS[kind]}`}>
                    <MultiselectMenu
                        className={'multiselect'}
                        options={options}
                        value={preferences[kind]}
                        title={() => VALUE_LABELS[preferences[kind]]}
                        onSelect={(value: EnhancedSkipMode) => selectMode(kind, value)}
                    />
                </Option>
            ))}
            <div role={'status'} aria-live={'polite'}>{message}</div>
        </>
    );
};

export default EnhancedSkipPreferences;
