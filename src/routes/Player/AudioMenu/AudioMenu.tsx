import React, { forwardRef, memo, MouseEvent, useCallback, useState, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import { languages } from 'stremio/common';
import { Button } from 'stremio/components';
import styles from './AudioMenu.less';

type Mode = 'off' | 'always' | 'scheduled';
type Strength = 'gentle' | 'balanced' | 'strong';
type NightAudioProfile = {
    when: Mode,
    configuration: 'automatic' | 'custom',
    strength: Strength,
    schedule: { timeZone: string, windows: Array<{ start: string, end: string }> },
    speakers: { size: string, layout: string, subwoofer: string },
};
type NightAudioState = {
    status: 'off' | 'checking' | 'applying' | 'removing' | 'active' | 'bypassed' | 'unavailable',
    requested: boolean,
    strength: string,
    audioPath: string,
};
type Props = {
    className: string,
    selectedAudioTrackId: string | null,
    audioTracks: AudioTrack[],
    onAudioTrackSelected: (id: string) => void,
    nightAudioSupported: boolean,
    nightAudioState: NightAudioState | null,
    nightAudioProfile: NightAudioProfile,
    nightAudioRoute: string,
    nightAudioRouteOptions: Record<string, string>,
    nightAudioSaved: boolean,
    onNightAudioRouteChanged: (route: string) => void,
    onNightAudioProfileChanged: (patch: Partial<NightAudioProfile>) => void,
};

const STATUS: Record<string, [string, string]> = {
    off: ['NIGHT_AUDIO_STATUS_OFF', 'Off'],
    checking: ['NIGHT_AUDIO_STATUS_CHECKING', 'Checking this audio output'],
    applying: ['NIGHT_AUDIO_STATUS_APPLYING', 'Applying audio processing'],
    removing: ['NIGHT_AUDIO_STATUS_REMOVING', 'Removing audio processing'],
    active: ['NIGHT_AUDIO_STATUS_ACTIVE', 'Processing active'],
    bypassed: ['NIGHT_AUDIO_STATUS_BYPASSED', 'Bitstream audio is being sent directly to your equipment'],
    unavailable: ['NIGHT_AUDIO_STATUS_UNAVAILABLE', 'Processing unavailable for this output'],
};

const AudioMenu = memo(forwardRef<HTMLDivElement, Props>(({
    className, selectedAudioTrackId, audioTracks, onAudioTrackSelected,
    nightAudioSupported, nightAudioState, nightAudioProfile, nightAudioRoute,
    nightAudioRouteOptions, nightAudioSaved, onNightAudioRouteChanged, onNightAudioProfileChanged,
}: Props, ref) => {
    const { t } = useTranslation();
    const [setupOpen, setSetupOpen] = useState(false);

    const onAudioTrackClick = useCallback(({ currentTarget }: MouseEvent) => {
        const id = currentTarget.getAttribute('data-id')!;
        onAudioTrackSelected && onAudioTrackSelected(id);
    }, [onAudioTrackSelected]);

    const onMouseDown = (event: MouseEvent) => {
        // @ts-expect-error: Property 'audioMenuClosePrevented' does not exist on type 'MouseEvent'.
        event.nativeEvent.audioMenuClosePrevented = true;
    };

    const changeMode = (when: Mode) => {
        onNightAudioProfileChanged({ when });
    };
    const changeSchedule = (field: 'start' | 'end', value: string) => {
        const first = nightAudioProfile.schedule.windows[0] || { start: '22:00', end: '07:00' };
        onNightAudioProfileChanged({
            schedule: {
                ...nightAudioProfile.schedule,
                windows: [{ ...first, [field]: value }],
            },
        });
    };
    const changeSpeakers = (field: 'size' | 'layout' | 'subwoofer', value: string) => {
        onNightAudioProfileChanged({
            speakers: { ...nightAudioProfile.speakers, [field]: value },
        });
    };
    const statusText = STATUS[nightAudioState?.status ?? 'checking'] || STATUS.checking;
    const status = !nightAudioSupported ?
        t('NIGHT_AUDIO_UNSUPPORTED', { defaultValue: 'This player does not support Night Audio yet' }) :
        t(statusText[0], { defaultValue: statusText[1] });
    const schedule = nightAudioProfile.schedule.windows[0] || { start: '22:00', end: '07:00' };

    return (
        <div ref={ref} className={classNames(className, styles['audio-menu'])} onMouseDown={onMouseDown}>
            <div className={styles['container']}>
                <div className={styles['section']}>
                    <div className={styles['header']}>{t('AUDIO_TRACKS')}</div>
                    <div className={styles['list']}>
                        {audioTracks.map(({ id, label, lang }, index) => (
                            <Button
                                key={id || index}
                                title={label}
                                className={classNames(styles['option'], { 'selected': selectedAudioTrackId === id })}
                                data-id={id}
                                onClick={onAudioTrackClick}
                            >
                                <div className={styles['info']}>
                                    <div className={styles['lang']}>{languages.label(lang)}</div>
                                    <div className={styles['label']}>{label}</div>
                                </div>
                                {selectedAudioTrackId === id ? <div className={styles['icon']} /> : null}
                            </Button>
                        ))}
                        {audioTracks.length === 0 ?
                            <div className={styles['description']}>{t('NIGHT_AUDIO_NO_TRACKS', { defaultValue: 'No selectable audio tracks reported' })}</div> : null}
                    </div>
                </div>
                <div className={styles['section']}>
                    <div className={styles['header']}>{t('NIGHT_AUDIO_TITLE', { defaultValue: 'Night Audio and dialogue' })}</div>
                    <div className={styles['status']} role="status" aria-live="polite">{status}</div>
                    <div className={styles['mode-row']} role="group" aria-label={t('NIGHT_AUDIO_ACTIVATION', { defaultValue: 'Night Audio activation' })}>
                        {([
                            ['off', 'Off'], ['always', 'Always'], ['scheduled', 'Scheduled'],
                        ] as Array<[Mode, string]>).map(([mode, label]) => (
                            <Button
                                key={mode}
                                className={classNames(styles['mode-button'], {
                                    [styles['mode-selected']]: nightAudioProfile.when === mode,
                                })}
                                aria-pressed={nightAudioProfile.when === mode}
                                onClick={() => changeMode(mode)}
                            >
                                {t('NIGHT_AUDIO_MODE_' + mode.toUpperCase(), { defaultValue: label })}
                            </Button>
                        ))}
                    </div>
                    <label className={styles['field']}>
                        <span>{t('NIGHT_AUDIO_OUTPUT', { defaultValue: 'Audio output profile' })}</span>
                        <select
                            value={nightAudioRoute}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                onNightAudioRouteChanged(event.currentTarget.value)}
                        >
                            {Object.entries(nightAudioRouteOptions).map(([id, label]) => (
                                <option key={id} value={id}>{t('NIGHT_AUDIO_OUTPUT_' + id.toUpperCase(), { defaultValue: label })}</option>
                            ))}
                        </select>
                    </label>
                    <div className={styles['description']}>
                        {t('NIGHT_AUDIO_MANUAL_ROUTE', { defaultValue: 'Output selection is manual. It does not switch your TV or sound system.' })}
                    </div>
                    {nightAudioProfile.when === 'scheduled' ?
                        <div className={styles['schedule']}>
                            <label className={styles['field']}>
                                <span>{t('NIGHT_AUDIO_FROM', { defaultValue: 'From' })}</span>
                                <input type="time" value={schedule.start}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                        changeSchedule('start', event.currentTarget.value)} />
                            </label>
                            <label className={styles['field']}>
                                <span>{t('NIGHT_AUDIO_UNTIL', { defaultValue: 'Until' })}</span>
                                <input type="time" value={schedule.end}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                        changeSchedule('end', event.currentTarget.value)} />
                            </label>
                            <div className={styles['description']}>
                                {t('NIGHT_AUDIO_SCHEDULE_TIMEZONE', {
                                    defaultValue: 'Daily, using {{timeZone}}. Overnight hours are supported.',
                                    timeZone: nightAudioProfile.schedule.timeZone,
                                })}
                            </div>
                        </div> : null}
                    <label className={styles['field']}>
                        <span>{t('NIGHT_AUDIO_BALANCE', { defaultValue: 'Sound balancing' })}</span>
                        <select value={nightAudioProfile.configuration}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                onNightAudioProfileChanged({
                                    configuration: event.currentTarget.value as 'automatic' | 'custom',
                                })}>
                            <option value="automatic">{t('NIGHT_AUDIO_AUTOMATIC', { defaultValue: 'Automatic, balanced' })}</option>
                            <option value="custom">{t('NIGHT_AUDIO_CUSTOM', { defaultValue: 'Custom' })}</option>
                        </select>
                    </label>
                    {nightAudioProfile.configuration === 'custom' ?
                        <label className={styles['field']}>
                            <span>{t('NIGHT_AUDIO_STRENGTH', { defaultValue: 'Compression strength' })}</span>
                            <select value={nightAudioProfile.strength}
                                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                    onNightAudioProfileChanged({ strength: event.currentTarget.value as Strength })}>
                                <option value="gentle">{t('NIGHT_AUDIO_GENTLE', { defaultValue: 'Gentle' })}</option>
                                <option value="balanced">{t('NIGHT_AUDIO_BALANCED', { defaultValue: 'Balanced' })}</option>
                                <option value="strong">{t('NIGHT_AUDIO_STRONG', { defaultValue: 'Strong' })}</option>
                            </select>
                        </label> : null}
                    <Button className={styles['setup-button']} onClick={() => setSetupOpen(!setupOpen)}
                        aria-expanded={setupOpen}>
                        {setupOpen ?
                            t('NIGHT_AUDIO_HIDE_SETUP', { defaultValue: 'Hide audio equipment details' }) :
                            t('NIGHT_AUDIO_SHOW_SETUP', { defaultValue: 'Configure audio equipment' })}
                    </Button>
                    {setupOpen ?
                        <div className={styles['setup']}>
                            <div className={styles['description']}>
                                {t('NIGHT_AUDIO_SETUP_NOTE', {
                                    defaultValue: 'These details are saved for future calibration. They do not detect your speakers or change the current compression automatically.',
                                })}
                            </div>
                            <label className={styles['field']}>
                                <span>{t('NIGHT_AUDIO_SPEAKER_SIZE', { defaultValue: 'Speaker size' })}</span>
                                <select value={nightAudioProfile.speakers.size}
                                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                        changeSpeakers('size', event.currentTarget.value)}>
                                    <option value="unknown">{t('NIGHT_AUDIO_UNKNOWN', { defaultValue: 'Not sure' })}</option>
                                    <option value="small">{t('NIGHT_AUDIO_SMALL', { defaultValue: 'Small' })}</option>
                                    <option value="medium">{t('NIGHT_AUDIO_MEDIUM', { defaultValue: 'Medium' })}</option>
                                    <option value="large">{t('NIGHT_AUDIO_LARGE', { defaultValue: 'Large' })}</option>
                                </select>
                            </label>
                            <label className={styles['field']}>
                                <span>{t('NIGHT_AUDIO_LAYOUT', { defaultValue: 'Speaker arrangement' })}</span>
                                <select value={nightAudioProfile.speakers.layout}
                                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                        changeSpeakers('layout', event.currentTarget.value)}>
                                    {['unknown', '2.0', '2.1', '3.1', '5.1', '7.1', 'atmos'].map((layout) =>
                                        <option key={layout} value={layout}>
                                            {layout === 'unknown' ? t('NIGHT_AUDIO_UNKNOWN', { defaultValue: 'Not sure' }) :
                                                layout === 'atmos' ?
                                                    t('NIGHT_AUDIO_ATMOS', { defaultValue: 'Dolby Atmos or height speakers' }) : layout}
                                        </option>)}
                                </select>
                            </label>
                            <label className={styles['field']}>
                                <span>{t('NIGHT_AUDIO_SUBWOOFER', { defaultValue: 'Separate subwoofer' })}</span>
                                <select value={nightAudioProfile.speakers.subwoofer}
                                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                        changeSpeakers('subwoofer', event.currentTarget.value)}>
                                    <option value="unknown">{t('NIGHT_AUDIO_UNKNOWN', { defaultValue: 'Not sure' })}</option>
                                    <option value="yes">{t('NIGHT_AUDIO_YES', { defaultValue: 'Yes' })}</option>
                                    <option value="no">{t('NIGHT_AUDIO_NO', { defaultValue: 'No' })}</option>
                                </select>
                            </label>
                        </div> : null}
                    {!nightAudioSaved ?
                        <div className={styles['warning']}>{t('NIGHT_AUDIO_SAVE_ERROR', { defaultValue: 'Settings could not be saved on this device.' })}</div> : null}
                    <div className={styles['description']}>
                        {t('NIGHT_AUDIO_DIALOGUE_NOTE', {
                            defaultValue: 'Dialogue specific boosting is not yet available. Compression only applies to confirmed decoded audio and will not force surround passthrough off.',
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}));

export default AudioMenu;
