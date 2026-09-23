package com.thiajay.stremio.tvacceptance;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.Arrays;
import java.util.List;

public final class MainActivity extends Activity {
    public static final String CORE_SOURCE_SHA = "e12b41173b0aca767794fb6854f535817ad07654";
    public static final String WEB_SOURCE_SHA = "26f2a5987618c62199593dec9a7ca18f0b2ac9f2";

    private final SkipContract contract = new SkipContract();
    private Button playbackControl;
    private Button nextVideoAction;
    private Button skipAction;
    private TextView status;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(48, 48, 48, 48);

        TextView binding = new TextView(this);
        binding.setText("Web " + WEB_SOURCE_SHA + " Core " + CORE_SOURCE_SHA);
        root.addView(binding);

        playbackControl = new Button(this);
        playbackControl.setId(View.generateViewId());
        playbackControl.setText("Playback Control");
        playbackControl.setAllCaps(false);
        playbackControl.setFocusable(true);
        root.addView(playbackControl);

        nextVideoAction = new Button(this);
        nextVideoAction.setId(View.generateViewId());
        nextVideoAction.setText("Next Video");
        nextVideoAction.setAllCaps(false);
        nextVideoAction.setFocusable(true);
        nextVideoAction.setVisibility(View.GONE);
        nextVideoAction.setOnClickListener(v -> {
            contract.dispatchNextEpisodeForControlTest();
            status.setText("next:" + contract.getNextEpisodeDispatchCount());
            render();
        });
        root.addView(nextVideoAction);

        skipAction = new Button(this);
        skipAction.setId(View.generateViewId());
        skipAction.setAllCaps(false);
        skipAction.setFocusable(true);
        skipAction.setOnClickListener(v -> {
            long target = contract.activateManual();
            if (target >= 0L) status.setText("seek:" + target);
            render();
        });
        root.addView(skipAction);

        playbackControl.setNextFocusDownId(skipAction.getId());
        skipAction.setNextFocusUpId(playbackControl.getId());
        nextVideoAction.setNextFocusUpId(playbackControl.getId());

        status = new TextView(this);
        status.setText("idle");
        root.addView(status);

        setContentView(root);
        contract.setSegments(defaultSegments());
        contract.setMode(SkipContract.Mode.ASK);
        contract.setPositionMs(20_000L);
        render();
        playbackControl.requestFocus();
    }

    public void setMode(SkipContract.Mode mode) { contract.setMode(mode); render(); }
    public void setPositionMs(long positionMs) { contract.setPositionMs(positionMs); render(); }
    public void setNextVideoVisible(boolean visible) { contract.setNextVideoVisible(visible); render(); }
    public void setMediaCapabilities(boolean live, boolean seekable) { contract.setMediaCapabilities(live, seekable); render(); }
    public void setGeneration(long generation) { contract.setGeneration(generation); render(); }
    public void setSegments(List<SkipContract.Segment> segments) { contract.setSegments(segments); render(); }
    public long getLastSeekTargetMs() { return contract.getLastSeekTargetMs(); }
    public int getNextEpisodeDispatchCount() { return contract.getNextEpisodeDispatchCount(); }

    private void render() {
        boolean nextVisible = contract.isNextVideoVisible();
        nextVideoAction.setVisibility(nextVisible ? View.VISIBLE : View.GONE);

        long automaticTarget = contract.evaluateAutomatic();
        if (automaticTarget >= 0L) status.setText("seek:" + automaticTarget);

        String label = contract.getVisibleActionLabel();
        if (label == null) {
            skipAction.setVisibility(View.GONE);
        } else {
            skipAction.setText(label);
            skipAction.setVisibility(View.VISIBLE);
        }

        if (nextVisible) {
            playbackControl.setNextFocusDownId(nextVideoAction.getId());
            nextVideoAction.setNextFocusDownId(skipAction.getId());
            nextVideoAction.requestFocus();
        } else {
            playbackControl.setNextFocusDownId(skipAction.getId());
            if (nextVideoAction.hasFocus() && skipAction.getVisibility() == View.VISIBLE) {
                skipAction.requestFocus();
            }
        }
    }

    private static List<SkipContract.Segment> defaultSegments() {
        return Arrays.asList(
                new SkipContract.Segment(SkipContract.Kind.INTRO, 10_000L, 40_000L),
                new SkipContract.Segment(SkipContract.Kind.RECAP, 45_000L, 70_000L),
                new SkipContract.Segment(SkipContract.Kind.CREDITS, 540_000L, 600_000L));
    }
}
