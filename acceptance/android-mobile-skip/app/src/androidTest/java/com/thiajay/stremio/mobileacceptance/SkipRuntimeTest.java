package com.thiajay.stremio.mobileacceptance;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static androidx.test.espresso.matcher.ViewMatchers.withText;
import static org.hamcrest.Matchers.not;
import static org.junit.Assert.assertEquals;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class SkipRuntimeTest {
    @Test public void askModeRendersIntroAndConsumesExactlyOnce() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            onView(withText("Skip Intro")).check(matches(isDisplayed())).perform(click());
            scenario.onActivity(activity -> { assertEquals(40_000L, activity.getLastSeekTargetMs()); assertEquals(0, activity.getNextEpisodeDispatchCount()); activity.setPositionMs(20_000L); });
            onView(withText("Skip Intro")).check(matches(not(isDisplayed())));
        }
    }

    @Test public void recapUsesTheSameContextualActionContract() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.setPositionMs(50_000L));
            onView(withText("Skip Recap")).check(matches(isDisplayed())).perform(click());
            scenario.onActivity(activity -> { assertEquals(70_000L, activity.getLastSeekTargetMs()); assertEquals(0, activity.getNextEpisodeDispatchCount()); });
        }
    }

    @Test public void creditsRemainASeekWithinCurrentMedia() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.setPositionMs(550_000L));
            onView(withText("Skip Credits")).check(matches(isDisplayed())).perform(click());
            scenario.onActivity(activity -> { assertEquals(600_000L, activity.getLastSeekTargetMs()); assertEquals(0, activity.getNextEpisodeDispatchCount()); });
        }
    }

    @Test public void nextVideoOverlayHasPriorityOverAskAndAutomaticSkip() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> { activity.setPositionMs(550_000L); activity.setNextVideoVisible(true); activity.setMode(SkipContract.Mode.ALWAYS); });
            onView(withText("Next Video")).check(matches(isDisplayed()));
            onView(withText("Skip Credits")).check(matches(not(isDisplayed())));
            scenario.onActivity(activity -> assertEquals(-1L, activity.getLastSeekTargetMs()));
            scenario.onActivity(activity -> activity.setNextVideoVisible(false));
            scenario.onActivity(activity -> { assertEquals(600_000L, activity.getLastSeekTargetMs()); assertEquals(0, activity.getNextEpisodeDispatchCount()); });
        }
    }

    @Test public void automaticSkipRunsOncePerPlaybackGeneration() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.setMode(SkipContract.Mode.ALWAYS));
            scenario.onActivity(activity -> assertEquals(40_000L, activity.getLastSeekTargetMs()));
            scenario.onActivity(activity -> activity.setPositionMs(20_000L));
            scenario.onActivity(activity -> assertEquals(40_000L, activity.getLastSeekTargetMs()));
            scenario.onActivity(activity -> { activity.setGeneration(2L); activity.setPositionMs(20_000L); });
            scenario.onActivity(activity -> { assertEquals(40_000L, activity.getLastSeekTargetMs()); assertEquals(0, activity.getNextEpisodeDispatchCount()); });
        }
    }

    @Test public void neverLiveAndUnseekableFailClosed() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.setMode(SkipContract.Mode.NEVER));
            onView(withText("Skip Intro")).check(matches(not(isDisplayed())));
            scenario.onActivity(activity -> assertEquals(-1L, activity.getLastSeekTargetMs()));
            scenario.onActivity(activity -> { activity.setMode(SkipContract.Mode.ASK); activity.setMediaCapabilities(true, true); });
            onView(withText("Skip Intro")).check(matches(not(isDisplayed())));
            scenario.onActivity(activity -> activity.setMediaCapabilities(false, false));
            onView(withText("Skip Intro")).check(matches(not(isDisplayed())));
            scenario.onActivity(activity -> { assertEquals(-1L, activity.getLastSeekTargetMs()); assertEquals(0, activity.getNextEpisodeDispatchCount()); });
        }
    }
}
