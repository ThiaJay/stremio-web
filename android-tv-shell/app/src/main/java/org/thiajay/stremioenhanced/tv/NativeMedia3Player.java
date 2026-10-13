package org.thiajay.stremioenhanced.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.audio.AudioSink;
import androidx.media3.exoplayer.audio.DefaultAudioSink;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.PlayerView;

import org.stremio.nightaudio.reference.NightAudioMedia3Processor;
import org.stremio.nightaudio.reference.PcmDynamicsProcessor;

/**
 * Optional, explicitly confirmed direct HTTPS playback in native Media3.
 * No native Stremio login, account service, cookie transfer or watched writes.
 * No raw stream URLs, titles or playback exceptions are logged or persisted.
 * Source codecs, external subtitles and real-device output are not yet accepted.
 */
@UnstableApi
public final class NativeMedia3Player {
    private final Activity activity;
    private final LinearLayout root;
    private final WebView webView;
    private final NightAudioMedia3Processor nightAudio = new NightAudioMedia3Processor();
    private ExoPlayer player;
    private PlayerView playerView;
    private LinearLayout panel;
    private TextView status;
    private AlertDialog confirmation;
    private boolean disposed;
    private String audioMode = "Off";

    public NativeMedia3Player(Activity activity, LinearLayout root, WebView webView) {
        this.activity = activity;
        this.root = root;
        this.webView = webView;
    }

    public boolean isOpen() { return confirmation != null || panel != null; }

    /** Requires a second, native TV remote confirmation even after the Web click. */
    public void request(String address) {
        if (disposed || isOpen() || !NativeSourcePolicy.isEligible(address)) return;
        confirmation = new AlertDialog.Builder(activity)
            .setTitle("Native Android TV playback (experimental)")
            .setMessage("Play this selected HTTPS source in Android's Media3 player? " +
                "This preview does not update watched history, transfer Web subtitles " +
                "or guarantee every codec. Use only sources you are entitled to watch.")
            .setPositiveButton("Play", (dialog, which) -> {
                confirmation = null;
                if (!disposed) start(address);
            })
            .setNegativeButton("Cancel", (dialog, which) -> confirmation = null)
            .setOnCancelListener(dialog -> confirmation = null)
            .create();
        confirmation.show();
    }

    private void start(String address) {
        if (disposed || panel != null || !NativeSourcePolicy.isEligible(address)) return;
        try {
            final DefaultRenderersFactory renderers = new DefaultRenderersFactory(activity) {
                @Override protected AudioSink buildAudioSink(Context context,
                        boolean enableFloatOutput, boolean enableAudioOutputPlaybackParams) {
                    return new DefaultAudioSink.Builder(context)
                        .setEnableFloatOutput(false)
                        .setEnableAudioOutputPlaybackParameters(enableAudioOutputPlaybackParams)
                        .setAudioProcessors(new AudioProcessor[] { nightAudio })
                        .build();
                }
            };
            final DefaultHttpDataSource.Factory https = new DefaultHttpDataSource.Factory()
                .setAllowCrossProtocolRedirects(false);
            player = new ExoPlayer.Builder(activity, renderers)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(https))
                .build();
            player.setAudioAttributes(AudioAttributes.DEFAULT, true);
            player.setRepeatMode(Player.REPEAT_MODE_OFF);
            player.setTrackSelectionParameters(player.getTrackSelectionParameters()
                .buildUpon().setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true).build());

            panel = new LinearLayout(activity);
            panel.setOrientation(LinearLayout.VERTICAL);
            panel.setBackgroundColor(Color.BLACK);
            status = new TextView(activity);
            status.setTextColor(Color.WHITE);
            status.setTextSize(15f);
            status.setPadding(16, 8, 16, 8);
            panel.addView(status, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

            final LinearLayout controls = new LinearLayout(activity);
            controls.setOrientation(LinearLayout.HORIZONTAL);
            Button closeButton = addButton(controls, "Back to Enhanced", this::close);
            addButton(controls, "Pause / Resume", () -> {
                if (player != null) player.setPlayWhenReady(!player.getPlayWhenReady());
            });
            addButton(controls, "Audio Off", () -> changeAudio(null, "Off"));
            addButton(controls, "Gentle", () ->
                changeAudio(PcmDynamicsProcessor.Strength.GENTLE, "Gentle"));
            addButton(controls, "Balanced", () ->
                changeAudio(PcmDynamicsProcessor.Strength.BALANCED, "Balanced"));
            addButton(controls, "Strong", () ->
                changeAudio(PcmDynamicsProcessor.Strength.STRONG, "Strong"));
            panel.addView(controls, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

            playerView = new PlayerView(activity);
            playerView.setUseController(true);
            playerView.setControllerAutoShow(true);
            playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING);
            playerView.setFocusable(true);
            playerView.setFocusableInTouchMode(true);
            playerView.setPlayer(player);
            panel.addView(playerView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

            player.addListener(new Player.Listener() {
                @Override public void onPlaybackStateChanged(int state) {
                    if (state == Player.STATE_READY) updateStatus("Media3 stream ready");
                    else if (state == Player.STATE_BUFFERING) updateStatus("Buffering");
                    else if (state == Player.STATE_ENDED) updateStatus("Playback ended");
                }
                @Override public void onPlayerError(PlaybackException error) {
                    // Never disclose URLs or exception details in logs/UI.
                    nightAudio.request(null);
                    audioMode = "Off";
                    updateStatus("Source could not play. Return to Enhanced to select another");
                }
            });
            webView.setVisibility(View.GONE);
            root.addView(panel, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
            updateStatus("Loading selected HTTPS stream");
            closeButton.requestFocus();
            player.setMediaItem(MediaItem.fromUri(Uri.parse(address)));
            player.prepare();
            player.play();
        } catch (RuntimeException error) {
            // No attempts to alter Stremio Core, history or the Web source.
            close();
        }
    }

    private Button addButton(LinearLayout controls, String text, Runnable action) {
        final Button b = new Button(activity);
        b.setText(text);
        b.setContentDescription(text);
        b.setFocusable(true);
        b.setAllCaps(false);
        b.setOnClickListener(v -> action.run());
        controls.addView(b, new LinearLayout.LayoutParams(
            0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        return b;
    }

    private void changeAudio(PcmDynamicsProcessor.Strength strength, String mode) {
        nightAudio.request(strength);
        audioMode = mode;
        updateStatus("Media3 playback");
    }

    private void updateStatus(String message) {
        if (status == null) return;
        final String dsp = "Off".equals(audioMode) ? "Night Audio off" :
            nightAudio.isPcmProcessingObserved() ?
            "Night Audio PCM observed; physical sound unverified" :
            "Night Audio requested; PCM processing not established";
        status.setText(message + ". " + dsp + ". Watched history unchanged");
    }

    public void pause() {
        if (player != null) player.setPlayWhenReady(false);
    }

    public void close() {
        if (confirmation != null) {
            final AlertDialog dialog = confirmation;
            confirmation = null;
            dialog.dismiss();
        }
        if (playerView != null) { playerView.setPlayer(null); playerView = null; }
        if (player != null) {
            player.stop();
            player.release();
            player = null;
        }
        nightAudio.request(null);
        audioMode = "Off";
        if (panel != null) {
            root.removeView(panel);
            panel.removeAllViews();
            panel = null;
            status = null;
        }
        webView.setVisibility(View.VISIBLE);
        webView.requestFocus();
    }

    public void destroy() {
        disposed = true;
        close();
    }
}
