'use strict';

// A user gesture sends one ephemeral direct-HTTPS URL to the trusted Android
// main-frame WebMessageListener. No watched state, cookies or history data.
const NAME = 'stremioEnhancedTvNative';

const eligibleUrl = (stream, coreReady, selected) => {
    if (coreReady !== true || typeof selected?.url !== 'string' ||
        typeof stream?.url !== 'string' || selected.url !== stream.url) return null;
    const url = stream.url;
    if (!url.startsWith('https://') || url.length > 4096 || url !== url.trim()) return null;
    for (let i = 0; i < url.length; i++) {
        const c = url.charCodeAt(i);
        if (c <= 0x20 || c === 0x7f || c === 0x5c) return null;
    }
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
            parsed.hash || (parsed.port && parsed.port !== '443') ||
            !host.includes('.') || host.startsWith('.') || host.endsWith('.') ||
            /(^|\.)localhost$|\.(local|lan|internal|home|test|invalid|onion)$/u.test(host) ||
            /^[0-9.]+$/u.test(host) || host.includes(':') ||
            !/^[a-z0-9.-]+$/u.test(host) ||
            host.split('.').some((label) => !label || label.length > 63 || /^-|-$/.test(label)) ||
            !parsed.pathname || parsed.pathname === '/') return null;
        return url;
    } catch (_) {
        return null;
    }
};

const bridgeForWindow = (w) => {
    try {
        const bridge = w?.[NAME];
        return typeof bridge?.postMessage === 'function' ? bridge : null;
    } catch (_) { return null; }
};

const requestNativePlayback = (bridge, url) => {
    if (!bridge || typeof bridge.postMessage !== 'function' ||
        eligibleUrl({ url }, true, { url }) === null) return false;
    try {
        bridge.postMessage(JSON.stringify({ v: 1, type: 'play', url }));
        return true;
    } catch (_) { return false; }
};

module.exports = { NAME, eligibleUrl, bridgeForWindow, requestNativePlayback };
