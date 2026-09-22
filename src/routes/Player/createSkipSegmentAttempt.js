// Copyright (C) 2017-2023 Smart code 203358507

const { getSegmentKey } = require('./skipSegmentIdentity');

// Synchronous claims cover double clicks, effect replay and revisiting earlier segments.
// Unknown actuator outcomes stay claimed. Capacity is bounded per playback lifecycle.
const createSkipSegmentAttempt = () => {
    let generation = 0;
    const consumed = new Set();
    const has = (segment) => {
        const key = getSegmentKey(segment);
        return key === null || segment.generation < generation ||
            (segment.generation === generation && (consumed.has(key) || consumed.size >= 64));
    };
    const claim = (segment) => {
        if (has(segment)) return false;
        if (segment.generation > generation) {
            generation = segment.generation;
            consumed.clear();
        }
        consumed.add(getSegmentKey(segment));
        return true;
    };
    return { has, claim };
};

module.exports = createSkipSegmentAttempt;
