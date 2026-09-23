package com.thiajay.stremio.mobileacceptance;

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
    private final SkipContract contract = new SkipContract();
    private Button skipAction;
    private TextView nextVideoOverlay;
    private TextView status;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(32, 32, 32, 32);
        TextView binding = new TextView(this);
        binding.setText("Core " + CORE_SOURCE_SHA);
        root.addView(binding);
        nextVideoOverlay = new TextView(this);
        nextVideoOverlay.setText("Next Video");
        nextVideoOverlay.setVisibility(View.GONE);
        root.addView(nextVideoOverlay);
        skipAction = new Button(this);
        skipAction.setAllCaps(false);
        skipAction.setOnClickListener(v -> {
            long target = contract.activateManual();
            if (target >= 0L) status.setText("seek:" + target);
            render();
        });
        root.addView(skipAction);
        status = new TextView(this);
        status.setText("idle");
        root.addView(status);
        setContentView(root);
        contract.setSegments(defaultSegments());
        contract.setMode(SkipContract.Mode.ASK);
        contract.setPositionMs(20_000L);
        render();
    }

    public void setMode(SkipContract.Mode mode) { contract.setMode(mode); render(); }
    public void setPositionMs(long positionMs) { contract.setPositionMs(positionMs); render(); }
    public void setNextVideoVisible(boolean visible) { contract.setNextVideoVisible(visible); render(); }
    public void setMediaCapabilities(boolean live, boolean seekable) { contract.setMediaCapabilities(live, seekable); render(); }
    public void setGeneration(long generation) { contract.setGeneration(generation); render(); }
    public void setSegments(List<SkipContract.Segment> segments) { contract.setSegments(segments); render(); }
    public long getLastSeekTargetMs() { return contract.getLastSeekTargetMs(); }
    public int getNextEpisodeDispatchCount() { return contract.getNextEpisodeDispatchCount(); }
    public void dispatchNextEpisodeForControlTest() { contract.dispatchNextEpisodeForControlTest(); render(); }

    private void render() {
        nextVideoOverlay.setVisibility(contract.isNextVideoVisible() ? View.VISIBLE : View.GONE);
        long automaticTarget = contract.evaluateAutomatic();
        if (automaticTarget >= 0L) status.setText("seek:" + automaticTarget);
        String label = contract.getVisibleActionLabel();
        if (label == null) skipAction.setVisibility(View.GONE);
        else { skipAction.setText(label); skipAction.setVisibility(View.VISIBLE); }
    }

    private static List<SkipContract.Segment> defaultSegments() {
        return Arrays.asList(
                new SkipContract.Segment(SkipContract.Kind.INTRO, 10_000L, 40_000L),
                new SkipContract.Segment(SkipContract.Kind.RECAP, 45_000L, 70_000L),
                new SkipContract.Segment(SkipContract.Kind.CREDITS, 540_000L, 600_000L));
    }
}
