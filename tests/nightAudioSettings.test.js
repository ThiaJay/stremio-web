const settings = require('../src/routes/Player/nightAudioSettings');

const store = () => {
    const values = {};
    return {
        getItem: (key) => values[key] ?? null,
        setItem: (key, value) => { values[key] = value; },
    };
};

test('defaults off with an overnight schedule', () => {
    const p = settings.selectedProfile({ route: 'default', profiles: {} });
    expect(p.when).toBe('off');
    expect(p.configuration).toBe('automatic');
    expect(p.schedule.windows).toEqual([{ start: '22:00', end: '07:00' }]);
});

test('output profiles remain separate', () => {
    let state = { route: 'default', profiles: {} };
    state = settings.changeProfile(state, { when: 'always', strength: 'strong' });
    state = settings.chooseRoute(state, 'headphones');
    expect(settings.selectedProfile(state).when).toBe('off');
    state = settings.changeProfile(state, { when: 'scheduled' });
    state = settings.chooseRoute(state, 'default');
    expect(settings.selectedProfile(state).when).toBe('always');
    expect(settings.selectedProfile(state).strength).toBe('strong');
});

test('storage round trip keeps speaker setup and mode', () => {
    const storage = store();
    let state = { route: 'soundbar', profiles: {} };
    state = settings.changeProfile(state, {
        when: 'scheduled', configuration: 'custom', strength: 'gentle',
        speakers: { size: 'small', layout: '3.1', subwoofer: 'yes' },
    });
    expect(settings.writeState(storage, state)).toBe(true);
    expect(settings.readState(storage)).toEqual(state);
});

test('malformed settings cannot silently enable sound processing', () => {
    const p = settings.normaliseProfile({
        when: 'unrecognised',
        strength: 'invalid',
        schedule: { timeZone: 'Invalid/Zone', windows: [
            { start: '29:00', end: '07:00' },
            { start: '21:00', end: '21:00' },
        ] },
        speakers: { layout: '13.1', subwoofer: 'yes' },
    }, 'Europe/London');
    expect(p.when).toBe('off');
    expect(p.strength).toBe('balanced');
    expect(p.schedule.windows).toEqual([{ start: '22:00', end: '07:00' }]);
    expect(p.speakers.layout).toBe('unknown');
});

test('blocked local storage does not produce a false saved result', () => {
    expect(settings.readState({ getItem: () => { throw new Error('denied'); } }))
        .toEqual({ route: 'default', profiles: {} });
    expect(settings.writeState({ setItem: () => { throw new Error('denied'); } },
        { route: 'default', profiles: {} })).toBe(false);
});

test('manual output selection does not infer the physical device', () => {
    const initial = { route: 'default', profiles: {} };
    expect(settings.chooseRoute(initial, 'unknown-device')).toBe(initial);
    expect(settings.ROUTES.default).toContain('not detected');
});
