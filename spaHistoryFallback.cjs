'use strict';

// Keep the local preview server and the production container in agreement.
// Only recognised application routes may fall back to index.html.
const CLIENT_ROUTE = /^\/(?:intro|discover|library|calendar|continuewatching|search|metadetails|detail|addons|settings|player)(?:\/|$)/;

function isClientRoute(pathname) {
    return typeof pathname === 'string' && CLIENT_ROUTE.test(pathname);
}

const historyApiFallback = {
    rewrites: [
        // Match before the default dot rule, since player links can contain file extensions.
        { from: CLIENT_ROUTE, to: '/index.html' },
        // Do not turn unknown endpoints or missing files into a false HTTP 200.
        { from: /./, to: ({ parsedUrl }) => parsedUrl.pathname }
    ]
};

// HashRouter owns client routes. A recognised HTTP path must be converted
// before React mounts, or a direct /library URL silently opens the home screen.
function canonicalizeInitialClientPath(location, history) {
    if (!location || !history || typeof history.replaceState !== 'function' ||
        !isClientRoute(location.pathname)) return false;
    const hash = typeof location.hash === 'string' ? location.hash : '';
    if (hash && !hash.startsWith('#/')) return false;
    const search = typeof location.search === 'string' ? location.search : '';
    const next = '/' + (hash || '#' + location.pathname + search);
    history.replaceState(history.state, '', next);
    return true;
}

module.exports = { isClientRoute, historyApiFallback, canonicalizeInitialClientPath };
