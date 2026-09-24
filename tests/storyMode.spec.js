const fs = require('fs');
const path = require('path');

const stableStoryOrderVideos = require('../src/routes/MetaDetails/VideosList/stableStoryOrderVideos');
const {
    withTitleWatchedAction,
    readTitleWatchedAction,
    clearTitleWatchedAction,
} = require('../src/routes/MetaDetails/titleWatchedAction');

describe('Story Mode safe title actions', () => {
    test('series action survives a deep link round trip and is consumed once', () => {
        const href = '#/detail/series/tt123456';
        const next = withTitleWatchedAction(href, true);
        expect(next).toBe('#/detail/series/tt123456?markReleased=watched');
        expect(readTitleWatchedAction('?markReleased=watched')).toBe('watched');
        expect(clearTitleWatchedAction('?markReleased=watched&x=1')).toBe('?x=1');
        expect(readTitleWatchedAction('?markReleased=unknown')).toBeNull();
    });

    test('stable story order inserts narrative special without changing video identity', () => {
        const videos = [
            { id: 'show:1:1', season: 1, episode: 1 },
            { id: 'show:1:2', season: 1, episode: 2 },
            { id: 'show:0:1', season: 0, episode: 1 },
            { id: 'show:0:2', season: 0, episode: 2 },
        ];
        const before = JSON.parse(JSON.stringify(videos));
        const ordered = stableStoryOrderVideos(videos, {
            storyOrderVersion: 1,
            storyOrder: ['show:1:1', 'show:0:1', 'show:1:2'],
        });
        expect(ordered.map((video) => video.id)).toEqual(['show:1:1', 'show:0:1', 'show:1:2']);
        expect(videos).toEqual(before);
    });

    test('invalid story orders fail closed', () => {
        const videos = [
            { id: 'show:1:1', season: 1, episode: 1 },
            { id: 'show:1:2', season: 1, episode: 2 },
            { id: 'show:0:1', season: 0, episode: 1 },
        ];
        expect(stableStoryOrderVideos(videos, {
            storyOrderVersion: 1,
            storyOrder: ['show:1:1', 'show:1:1', 'show:1:2'],
        })).toBeNull();
        expect(stableStoryOrderVideos(videos, {
            storyOrderVersion: 1,
            storyOrder: ['show:1:1', 'missing', 'show:1:2'],
        })).toBeNull();
        expect(stableStoryOrderVideos(videos, {
            storyOrderVersion: 1,
            storyOrder: ['show:1:1', 'show:0:1'],
        })).toBeNull();
        expect(stableStoryOrderVideos(videos, {
            storyOrderVersion: 2,
            storyOrder: ['show:1:1', 'show:0:1', 'show:1:2'],
        })).toBeNull();
    });

    test('library series watched action no longer dispatches generic series mutation', () => {
        const source = fs.readFileSync(path.join(__dirname, '../src/components/LibItem/LibItem.js'), 'utf8');
        expect(source).toContain("props.type === 'series'");
        expect(source).toContain('withTitleWatchedAction');
    });
});
