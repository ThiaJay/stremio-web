const chooseAudioTrack = require('../src/routes/Player/chooseAudioTrack');

const normalizeLanguage = (value) => typeof value === 'string' ? value.toLowerCase() : undefined;
const choose = (tracks, selectedId, savedTrack, preference, globalLanguage = 'eng') =>
    chooseAudioTrack(tracks, selectedId, savedTrack, preference, globalLanguage, normalizeLanguage);

const main = { id: 'main', lang: 'eng', label: 'English 5.1' };
const commentary = { id: 'commentary', lang: 'eng', label: 'English Director Commentary' };
const description = { id: 'described', lang: 'eng', label: 'English audio description' };

describe('language-matched audio selection', () => {
    test('avoids commentary when a primary track exists for the same language', () => {
        expect(choose([commentary, main], commentary.id)).toBe(main);
    });

    test('avoids audio description when ordinary audio exists', () => {
        expect(choose([description, main], null)).toBe(main);
    });

    test('preserves an intentional saved audio-description track', () => {
        expect(choose([description, main], null, { id: description.id, language: 'eng' })).toBe(description);
    });

    test('preserves a backend-selected ordinary audio track', () => {
        const stereo = { id: 'stereo', lang: 'eng', label: 'English Stereo' };
        expect(choose([stereo, main], main.id)).toBe(main);
    });

    test('session preference takes precedence over global language', () => {
        const japanese = { id: 'jpn', lang: 'jpn', label: 'Japanese' };
        expect(choose([main, japanese], main.id, null, { language: 'jpn' })).toBe(japanese);
    });

    test('saved track is not reused if its language conflicts with a new session preference', () => {
        const japanese = { id: 'jpn', lang: 'jpn', label: 'Japanese' };
        expect(choose([main, japanese], main.id, { id: 'main', language: 'eng' }, { language: 'jpn' })).toBe(japanese);
    });

    test('does not discard the only matching audio track', () => {
        expect(choose([commentary], null)).toBe(commentary);
    });

    test('does not misread a directors cut as commentary', () => {
        const directorsCut = { id: 'dc', lang: 'eng', label: "English Director's Cut 5.1" };
        expect(choose([commentary, directorsCut], commentary.id)).toBe(directorsCut);
    });

    test('does not select arbitrary audio when no language preference matches', () => {
        const french = { id: 'fra', lang: 'fra', label: 'French' };
        expect(choose([french], null, null, null, 'eng')).toBeUndefined();
        expect(choose([], null)).toBeUndefined();
    });

    test('unknown labels are not classified as alternative audio', () => {
        const unknown = { id: 'other', lang: 'eng' };
        expect(choose([unknown, commentary], commentary.id)).toBe(unknown);
    });
});
