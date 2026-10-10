const { isClientRoute, historyApiFallback, canonicalizeInitialClientPath } = require('../spaHistoryFallback.cjs');

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

describe('browser deep links to HashRouter', () => {
    const cases = [
        ['/intro', '', '', '/#/intro'],
        ['/library', '', '', '/#/library'],
        ['/search', '?query=Alone%20S13', '', '/#/search?query=Alone%20S13'],
        ['/settings', '', '', '/#/settings'],
        ['/continuewatching', '', '', '/#/continuewatching'],
        ['/metadetails/series/tt12345:1:1', '', '', '/#/metadetails/series/tt12345:1:1'],
        ['/player/https%3A%2F%2Fexample.org%2Fepisode.mkv', '', '', '/#/player/https%3A%2F%2Fexample.org%2Fepisode.mkv'],
        ['/library', '', '#/search?query=Alone', '/#/search?query=Alone']
    ];
    test.each(cases)('canonicalises %s without decoding provider URLs or losing route state', (pathname, search, hash, destination) => {
        const history = { state: { navigation: 'preserved' }, replaceState: jest.fn() };
        const location = { pathname, search, hash };
        expect(canonicalizeInitialClientPath(location, history)).toBe(true);
        expect(history.replaceState).toHaveBeenCalledTimes(1);
        expect(history.replaceState).toHaveBeenCalledWith(history.state, '', destination);
    });

    test.each(['/', '/api/private', '/not-real.js', '/playeroops', '/searching'])(
        'does not rewrite unrelated request paths %s', pathname => {
            const history = { replaceState: jest.fn() };
            expect(canonicalizeInitialClientPath({ pathname, search: '', hash: '' }, history)).toBe(false);
            expect(history.replaceState).not.toHaveBeenCalled();
        }
    );
    test('keeps unknown hash fragments and refuses missing browser history APIs', () => {
        const history = { replaceState: jest.fn() };
        expect(canonicalizeInitialClientPath({ pathname: '/library', hash: '#some-anchor' }, history)).toBe(false);
        expect(canonicalizeInitialClientPath({ pathname: '/library', hash: '' }, null)).toBe(false);
        expect(history.replaceState).not.toHaveBeenCalled();
    });
});
