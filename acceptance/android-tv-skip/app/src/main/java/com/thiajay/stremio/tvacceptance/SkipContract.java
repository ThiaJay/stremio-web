package com.thiajay.stremio.tvacceptance;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class SkipContract {
    public enum Mode { ASK, ALWAYS, NEVER }
    public enum Kind { INTRO, RECAP, CREDITS }

    public static final class Segment {
        public final Kind kind;
        public final long startMs;
        public final long endMs;

        public Segment(Kind kind, long startMs, long endMs) {
            if (kind == null) throw new IllegalArgumentException("kind is required");
            if (startMs < 0 || endMs <= startMs) throw new IllegalArgumentException("invalid segment range");
            this.kind = kind;
            this.startMs = startMs;
            this.endMs = endMs;
        }

        String identity(long generation) {
            return String.format(Locale.ROOT, "%d:%s:%d:%d", generation, kind.name(), startMs, endMs);
        }
    }

    private final List<Segment> segments = new ArrayList<>();
    private final Set<String> consumed = new HashSet<>();
    private Mode mode = Mode.ASK;
    private long positionMs;
    private long generation = 1L;
    private boolean live;
    private boolean seekable = true;
    private boolean nextVideoVisible;
    private long lastSeekTargetMs = -1L;
    private int nextEpisodeDispatchCount;

    public void setSegments(List<Segment> values) { segments.clear(); if (values != null) segments.addAll(values); }
    public void setMode(Mode value) { mode = value == null ? Mode.ASK : value; }
    public void setPositionMs(long value) { positionMs = Math.max(0L, value); }
    public void setGeneration(long value) { if (value != generation) { generation = value; consumed.clear(); } }
    public void setMediaCapabilities(boolean isLive, boolean isSeekable) { live = isLive; seekable = isSeekable; }
    public void setNextVideoVisible(boolean value) { nextVideoVisible = value; }
    public boolean isNextVideoVisible() { return nextVideoVisible; }
    public long getLastSeekTargetMs() { return lastSeekTargetMs; }
    public int getNextEpisodeDispatchCount() { return nextEpisodeDispatchCount; }
    public void dispatchNextEpisodeForControlTest() { nextEpisodeDispatchCount += 1; }

    public String getVisibleActionLabel() {
        if (mode != Mode.ASK) return null;
        Segment segment = activeSegment();
        return segment == null ? null : labelFor(segment.kind);
    }

    public long activateManual() {
        if (mode != Mode.ASK) return -1L;
        Segment segment = activeSegment();
        return segment == null ? -1L : consumeAsSeek(segment);
    }

    public long evaluateAutomatic() {
        if (mode != Mode.ALWAYS) return -1L;
        Segment segment = activeSegment();
        return segment == null ? -1L : consumeAsSeek(segment);
    }

    private Segment activeSegment() {
        if (live || !seekable || nextVideoVisible) return null;
        for (Segment segment : segments) {
            if (positionMs >= segment.startMs && positionMs < segment.endMs && !consumed.contains(segment.identity(generation))) return segment;
        }
        return null;
    }

    private long consumeAsSeek(Segment segment) {
        consumed.add(segment.identity(generation));
        lastSeekTargetMs = segment.endMs;
        return lastSeekTargetMs;
    }

    private static String labelFor(Kind kind) {
        switch (kind) {
            case INTRO: return "Skip Intro";
            case RECAP: return "Skip Recap";
            case CREDITS: return "Skip Credits";
            default: throw new IllegalStateException("Unknown segment kind");
        }
    }
}
