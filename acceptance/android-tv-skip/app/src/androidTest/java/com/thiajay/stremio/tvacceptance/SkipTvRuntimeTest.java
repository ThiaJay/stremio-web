package com.thiajay.stremio.tvacceptance;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.pm.PackageManager;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class SkipTvRuntimeTest {
    @Test public void androidTvRemoteFocusNavigatesToIntroAndActivatesSeek() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                assertTrue(activity.getPackageManager().hasSystemFeature(PackageManager.FEATURE_LEANBACK));
                assertFocused(activity, "Playback Control");
                assertVisible(activity, "Skip Intro");
            });
            press(KeyEvent.KEYCODE_DPAD_DOWN);
            scenario.onActivity(activity -> assertFocused(activity, "Skip Intro"));
            press(KeyEvent.KEYCODE_DPAD_CENTER);
            scenario.onActivity(activity -> {
                assertEquals(40_000L, activity.getLastSeekTargetMs());
                assertEquals(0, activity.getNextEpisodeDispatchCount());
                assertHidden(activity, "Skip Intro");
            });
        }
    }

    @Test public void recapUsesSameRemoteContextualActionContract() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.setPositionMs(50_000L));
            press(KeyEvent.KEYCODE_DPAD_DOWN);
            scenario.onActivity(activity -> assertFocused(activity, "Skip Recap"));
            press(KeyEvent.KEYCODE_DPAD_CENTER);
            scenario.onActivity(activity -> {
                assertEquals(70_000L, activity.getLastSeekTargetMs());
                assertEquals(0, activity.getNextEpisodeDispatchCount());
            });
        }
    }

    @Test public void creditsRemoteActionRemainsSeekWithinCurrentMedia() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.setPositionMs(550_000L));
            press(KeyEvent.KEYCODE_DPAD_DOWN);
            scenario.onActivity(activity -> assertFocused(activity, "Skip Credits"));
            press(KeyEvent.KEYCODE_DPAD_CENTER);
            scenario.onActivity(activity -> {
                assertEquals(600_000L, activity.getLastSeekTargetMs());
                assertEquals(0, activity.getNextEpisodeDispatchCount());
            });
        }
    }

    @Test public void nextVideoOwnsFocusAndPriorityDuringCreditsCollision() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                activity.setPositionMs(550_000L);
                activity.setNextVideoVisible(true);
                assertVisible(activity, "Next Video");
                assertHidden(activity, "Skip Credits");
                assertFocused(activity, "Next Video");
                assertEquals(-1L, activity.getLastSeekTargetMs());
            });
            press(KeyEvent.KEYCODE_DPAD_CENTER);
            scenario.onActivity(activity -> {
                assertEquals(1, activity.getNextEpisodeDispatchCount());
                assertEquals(-1L, activity.getLastSeekTargetMs());
                activity.setNextVideoVisible(false);
                assertVisible(activity, "Skip Credits");
                focus(activity, "Skip Credits");
            });
            press(KeyEvent.KEYCODE_DPAD_CENTER);
            scenario.onActivity(activity -> {
                assertEquals(600_000L, activity.getLastSeekTargetMs());
                assertEquals(1, activity.getNextEpisodeDispatchCount());
            });
        }
    }

    @Test public void automaticModeSkipsOncePerPlaybackGenerationWithoutNextEpisodeDispatch() {
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

    @Test public void nextVideoPrioritySuppressesAutomaticCreditsUntilOverlayClears() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                activity.setPositionMs(550_000L);
                activity.setNextVideoVisible(true);
                activity.setMode(SkipContract.Mode.ALWAYS);
                assertEquals(-1L, activity.getLastSeekTargetMs());
                activity.setNextVideoVisible(false);
                assertEquals(600_000L, activity.getLastSeekTargetMs());
                assertEquals(0, activity.getNextEpisodeDispatchCount());
            });
        }
    }

    @Test public void neverLiveAndUnseekableStatesFailClosed() {
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

    private static void press(int keyCode) {
        InstrumentationRegistry.getInstrumentation().sendKeyDownUpSync(keyCode);
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
    }

    private static void assertVisible(MainActivity activity, String text) {
        TextView view = findText(activity.getWindow().getDecorView(), text);
        assertNotNull("Expected native TV view with text: " + text, view);
        assertTrue("Expected native TV view to be shown: " + text, view.isShown());
    }

    private static void assertHidden(MainActivity activity, String text) {
        TextView view = findText(activity.getWindow().getDecorView(), text);
        assertNotNull("Expected native TV view with text: " + text, view);
        assertFalse("Expected native TV view to be hidden: " + text, view.isShown());
    }

    private static void assertFocused(MainActivity activity, String text) {
        TextView view = findText(activity.getWindow().getDecorView(), text);
        assertNotNull("Expected focusable native TV view with text: " + text, view);
        assertTrue("Expected remote focus on: " + text, view.hasFocus());
    }

    private static void focus(MainActivity activity, String text) {
        TextView view = findText(activity.getWindow().getDecorView(), text);
        assertNotNull("Expected focusable native TV view with text: " + text, view);
        assertTrue("Expected focus request to succeed for: " + text, view.requestFocus());
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
