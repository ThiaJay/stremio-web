package com.thiajay.stremio.mobileacceptance;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class SkipRuntimeTest {
    @Test public void askModeRendersIntroAndConsumesExactlyOnce() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                assertVisible(activity, "Skip Intro");
                clickVisible(activity, "Skip Intro");
                assertEquals(40_000L, activity.getLastSeekTargetMs());
                assertEquals(0, activity.getNextEpisodeDispatchCount());
                activity.setPositionMs(20_000L);
                assertHidden(activity, "Skip Intro");
            });
        }
    }

    @Test public void recapUsesTheSameContextualActionContract() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                activity.setPositionMs(50_000L);
                assertVisible(activity, "Skip Recap");
                clickVisible(activity, "Skip Recap");
                assertEquals(70_000L, activity.getLastSeekTargetMs());
                assertEquals(0, activity.getNextEpisodeDispatchCount());
            });
        }
    }

    @Test public void creditsRemainASeekWithinCurrentMedia() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                activity.setPositionMs(550_000L);
                assertVisible(activity, "Skip Credits");
                clickVisible(activity, "Skip Credits");
                assertEquals(600_000L, activity.getLastSeekTargetMs());
                assertEquals(0, activity.getNextEpisodeDispatchCount());
            });
        }
    }

    @Test public void nextVideoOverlayHasPriorityOverAskAndAutomaticSkip() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                activity.setPositionMs(550_000L);
                activity.setNextVideoVisible(true);
                activity.setMode(SkipContract.Mode.ALWAYS);
                assertVisible(activity, "Next Video");
                assertHidden(activity, "Skip Credits");
                assertEquals(-1L, activity.getLastSeekTargetMs());
                activity.setNextVideoVisible(false);
                assertEquals(600_000L, activity.getLastSeekTargetMs());
                assertEquals(0, activity.getNextEpisodeDispatchCount());
            });
        }
    }

    @Test public void automaticSkipRunsOncePerPlaybackGeneration() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                activity.setMode(SkipContract.Mode.ALWAYS);
                assertEquals(40_000L, activity.getLastSeekTargetMs());
                activity.setPositionMs(20_000L);
                assertEquals(40_000L, activity.getLastSeekTargetMs());
                activity.setGeneration(2L);
                activity.setPositionMs(20_000L);
                assertEquals(40_000L, activity.getLastSeekTargetMs());
                assertEquals(0, activity.getNextEpisodeDispatchCount());
            });
        }
    }

    @Test public void neverLiveAndUnseekableFailClosed() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                activity.setMode(SkipContract.Mode.NEVER);
                assertHidden(activity, "Skip Intro");
                assertEquals(-1L, activity.getLastSeekTargetMs());
                activity.setMode(SkipContract.Mode.ASK);
                activity.setMediaCapabilities(true, true);
                assertHidden(activity, "Skip Intro");
                activity.setMediaCapabilities(false, false);
                assertHidden(activity, "Skip Intro");
                assertEquals(-1L, activity.getLastSeekTargetMs());
                assertEquals(0, activity.getNextEpisodeDispatchCount());
            });
        }
    }

    private static void assertVisible(MainActivity activity, String text) {
        TextView view = findText(activity.getWindow().getDecorView(), text);
        assertNotNull("Expected native view with text: " + text, view);
        assertTrue("Expected native view to be shown: " + text, view.isShown());
    }

    private static void assertHidden(MainActivity activity, String text) {
        TextView view = findText(activity.getWindow().getDecorView(), text);
        assertNotNull("Expected native view with text: " + text, view);
        assertFalse("Expected native view to be hidden: " + text, view.isShown());
    }

    private static void clickVisible(MainActivity activity, String text) {
        TextView view = findText(activity.getWindow().getDecorView(), text);
        assertNotNull("Expected native action with text: " + text, view);
        assertTrue("Expected native action to be shown: " + text, view.isShown());
        assertTrue("Expected native action click listener to run: " + text, view.performClick());
    }

    private static TextView findText(View root, String text) {
        if (root instanceof TextView && text.contentEquals(((TextView) root).getText())) {
            return (TextView) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) root;
            for (int index = 0; index < group.getChildCount(); index++) {
                TextView found = findText(group.getChildAt(index), text);
                if (found != null) return found;
            }
        }
        return null;
    }
}
