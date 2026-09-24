// Copyright (C) 2017-2026 Smart code 203358507

function stableStoryOrderVideos(videos, behaviorHints) {
    if (!Array.isArray(videos) || videos.length === 0) return null;
    if (Number(behaviorHints?.storyOrderVersion) !== 1 || !Array.isArray(behaviorHints?.storyOrder) || behaviorHints.storyOrder.length === 0) {
        return null;
    }

    const byId = new Map(videos.map((video) => [String(video?.id || ''), video]));
    if (byId.size !== videos.length || byId.has('')) return null;

    const seen = new Set();
    const ordered = [];
    for (const rawId of behaviorHints.storyOrder) {
        const id = String(rawId || '');
        if (!id || seen.has(id) || !byId.has(id)) return null;
        seen.add(id);
        ordered.push(byId.get(id));
    }

    const regularIds = videos
        .filter((video) => Number(video?.season) > 0)
        .map((video) => String(video.id));
    if (regularIds.some((id) => !seen.has(id))) return null;

    return ordered;
}

module.exports = stableStoryOrderVideos;
