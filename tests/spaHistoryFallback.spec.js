const { isClientRoute, historyApiFallback } = require('../spaHistoryFallback.cjs');

describe('SPA history fallback', () => {
    test.each([
        '/intro',
        '/search',
        '/library',
        '/continuewatching',
        '/settings',
        '/metadetails/series/tt12345',
        '/detail/series/tt12345',
        '/player/https%3A%2F%2Fexample.org%2Fepisode.mkv',
        '/discover/series',
        '/addons/series'
    ])('recognises application route %s', (pathname) => {
        expect(isClientRoute(pathname)).toBe(true);
        expect(historyApiFallback.rewrites[0].from.test(pathname)).toBe(true);
    });

    test.each([
        '/',
        '/api/private',
        '/not-real.js',
        '/.well-known/not-found.json',
        '/manifest.json',
        '/playeroops',
        '/searching',
        '/intro-malformed'
    ])('does not rewrite non-client route %s', (pathname) => {
        expect(isClientRoute(pathname)).toBe(false);
        expect(historyApiFallback.rewrites[0].from.test(pathname)).toBe(false);
        expect(historyApiFallback.rewrites[1].to({ parsedUrl: { pathname } })).toBe(pathname);
    });

    test('uses one entry point, including for dotted player deep links', () => {
        expect(historyApiFallback.rewrites[0].to).toBe('/index.html');
        expect(isClientRoute('/player/https%3A%2F%2Fexample.org%2Fvideo.mkv')).toBe(true);
    });
});
