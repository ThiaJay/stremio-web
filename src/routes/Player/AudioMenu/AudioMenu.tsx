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

const STATUS: Record<string, string> = {
    off: 'Off',
    checking: 'Checking this audio output',
    applying: 'Applying audio processing',
    removing: 'Removing audio processing',
    active: 'Processing active',
    bypassed: 'Bitstream audio is being sent directly to your equipment',
    unavailable: 'Processing unavailable for this output',
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
    const status = !nightAudioSupported ? 'This player does not support Night Audio yet' :
        STATUS[nightAudioState?.status ?? 'checking'] || STATUS.checking;
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
                            <div className={styles['description']}>No selectable audio tracks reported</div> : null}
                    </div>
                </div>
                <div className={styles['section']}>
                    <div className={styles['header']}>Night Audio and dialogue</div>
                    <div className={styles['status']} role="status" aria-live="polite">{status}</div>
                    <div className={styles['mode-row']} role="group" aria-label="Night Audio activation">
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
                                {label}
                            </Button>
                        ))}
                    </div>
                    <label className={styles['field']}>
                        <span>Audio output profile</span>
                        <select
                            value={nightAudioRoute}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                onNightAudioRouteChanged(event.currentTarget.value)}
                        >
                            {Object.entries(nightAudioRouteOptions).map(([id, label]) => (
                                <option key={id} value={id}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <div className={styles['description']}>
                        Output selection is manual. It does not switch your TV or sound system.
                    </div>
                    {nightAudioProfile.when === 'scheduled' ?
                        <div className={styles['schedule']}>
                            <label className={styles['field']}>
                                <span>From</span>
                                <input type="time" value={schedule.start}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                        changeSchedule('start', event.currentTarget.value)} />
                            </label>
                            <label className={styles['field']}>
                                <span>Until</span>
                                <input type="time" value={schedule.end}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                        changeSchedule('end', event.currentTarget.value)} />
                            </label>
                            <div className={styles['description']}>
                                Daily, using {nightAudioProfile.schedule.timeZone}. Overnight hours are supported.
                            </div>
                        </div> : null}
                    <label className={styles['field']}>
                        <span>Sound balancing</span>
                        <select value={nightAudioProfile.configuration}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                onNightAudioProfileChanged({
                                    configuration: event.currentTarget.value as 'automatic' | 'custom',
                                })}>
                            <option value="automatic">Automatic, balanced</option>
                            <option value="custom">Custom</option>
                        </select>
                    </label>
                    {nightAudioProfile.configuration === 'custom' ?
                        <label className={styles['field']}>
                            <span>Compression strength</span>
                            <select value={nightAudioProfile.strength}
                                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                    onNightAudioProfileChanged({ strength: event.currentTarget.value as Strength })}>
                                <option value="gentle">Gentle</option>
                                <option value="balanced">Balanced</option>
                                <option value="strong">Strong</option>
                            </select>
                        </label> : null}
                    <Button className={styles['setup-button']} onClick={() => setSetupOpen(!setupOpen)}
                        aria-expanded={setupOpen}>
                        {setupOpen ? 'Hide audio equipment details' : 'Configure audio equipment'}
                    </Button>
                    {setupOpen ?
                        <div className={styles['setup']}>
                            <div className={styles['description']}>
                                These details are saved for future calibration. They do not detect your speakers
                                or change the current compression automatically.
                            </div>
                            <label className={styles['field']}>
                                <span>Speaker size</span>
                                <select value={nightAudioProfile.speakers.size}
                                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                        changeSpeakers('size', event.currentTarget.value)}>
                                    <option value="unknown">Not sure</option>
                                    <option value="small">Small</option>
                                    <option value="medium">Medium</option>
                                    <option value="large">Large</option>
                                </select>
                            </label>
                            <label className={styles['field']}>
                                <span>Speaker arrangement</span>
                                <select value={nightAudioProfile.speakers.layout}
                                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                        changeSpeakers('layout', event.currentTarget.value)}>
                                    {['unknown', '2.0', '2.1', '3.1', '5.1', '7.1', 'atmos'].map((layout) =>
                                        <option key={layout} value={layout}>
                                            {layout === 'unknown' ? 'Not sure' :
                                                layout === 'atmos' ? 'Dolby Atmos or height speakers' : layout}
                                        </option>)}
                                </select>
                            </label>
                            <label className={styles['field']}>
                                <span>Separate subwoofer</span>
                                <select value={nightAudioProfile.speakers.subwoofer}
                                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                        changeSpeakers('subwoofer', event.currentTarget.value)}>
                                    <option value="unknown">Not sure</option>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                </select>
                            </label>
                        </div> : null}
                    {!nightAudioSaved ?
                        <div className={styles['warning']}>Settings could not be saved on this device.</div> : null}
                    <div className={styles['description']}>
                        Dialogue specific boosting is not yet available. Compression only applies to
                        confirmed decoded audio and will not force surround passthrough off.
                    </div>
                </div>
            </div>
        </div>
    );
}));

export default AudioMenu;
