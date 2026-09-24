// Copyright (C) 2017-2026 Smart code 203358507

const PARAM = 'markReleased';

function withTitleWatchedAction(href, isWatched) {
    if (typeof href !== 'string' || href.length === 0) return href;
    const [base, query = ''] = href.split('?', 2);
    const params = new URLSearchParams(query);
    params.set(PARAM, isWatched ? 'watched' : 'unwatched');
    const next = params.toString();
    return next.length > 0 ? `${base}?${next}` : base;
}

function readTitleWatchedAction(search) {
    const value = new URLSearchParams(search || '').get(PARAM);
    return value === 'watched' || value === 'unwatched' ? value : null;
}

function clearTitleWatchedAction(search) {
    const params = new URLSearchParams(search || '');
    params.delete(PARAM);
    const next = params.toString();
    return next.length > 0 ? `?${next}` : '';
}

module.exports = {
    withTitleWatchedAction,
    readTitleWatchedAction,
    clearTitleWatchedAction,
};
