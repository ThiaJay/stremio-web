package com.stremio.common.players;

import androidx.annotation.Nullable;
import androidx.media3.common.C;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.Player;
import androidx.media3.common.Tracks;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.Renderer;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import io.github.anilbeesetti.nextlib.media3ext.ffdecoder.FfmpegAudioRenderer;

/**
 * Side-by-side Android TV acceptance controller.
 *
 * Keeps normal audio on the shipped automatic renderer order and disables non-FFmpeg
 * audio renderers only while a selected DTS-family track is active. Video renderers
 * are never modified.
 */
public final class SelectiveDtsAudioController implements Player.Listener {
    private final ExoPlayer player;
    private final DefaultTrackSelector trackSelector;
    private final boolean configuredTunnelingEnabled;
    private boolean ffmpegForced;

    private SelectiveDtsAudioController(
            ExoPlayer player,
            DefaultTrackSelector trackSelector,
            boolean configuredTunnelingEnabled) {
        this.player = player;
        this.trackSelector = trackSelector;
        this.configuredTunnelingEnabled = configuredTunnelingEnabled;
    }

    public static void attach(
            ExoPlayer player,
            DefaultTrackSelector trackSelector,
            boolean configuredTunnelingEnabled) {
        SelectiveDtsAudioController controller =
                new SelectiveDtsAudioController(player, trackSelector, configuredTunnelingEnabled);
        player.addListener(controller);
        controller.onTracksChanged(player.getCurrentTracks());
    }

    @Override
    public void onTracksChanged(Tracks tracks) {
        setFfmpegForced(isDts(selectedAudioMime(tracks)));
    }

    private void setFfmpegForced(boolean force) {
        if (force == ffmpegForced) {
            return;
        }

        DefaultTrackSelector.Parameters.Builder parameters = trackSelector.buildUponParameters()
                .setTunnelingEnabled(force ? false : configuredTunnelingEnabled);

        boolean foundFfmpegAudio = false;
        for (int index = 0; index < player.getRendererCount(); index++) {
            Renderer renderer = player.getRenderer(index);
            if (renderer.getTrackType() != C.TRACK_TYPE_AUDIO) {
                continue;
            }

            boolean ffmpeg = renderer instanceof FfmpegAudioRenderer;
            foundFfmpegAudio |= ffmpeg;
            parameters.setRendererDisabled(index, force && !ffmpeg);
        }

        if (force && !foundFfmpegAudio) {
            return;
        }

        trackSelector.setParameters(parameters.build());
        ffmpegForced = force;
    }

    @Nullable
    private static String selectedAudioMime(Tracks tracks) {
        for (Tracks.Group group : tracks.getGroups()) {
            if (group.getType() != C.TRACK_TYPE_AUDIO || !group.isSelected()) {
                continue;
            }
            for (int index = 0; index < group.length; index++) {
                if (group.isTrackSelected(index)) {
                    return group.getTrackFormat(index).sampleMimeType;
                }
            }
        }
        return null;
    }

    private static boolean isDts(@Nullable String mimeType) {
        return MimeTypes.AUDIO_DTS.equals(mimeType)
                || MimeTypes.AUDIO_DTS_HD.equals(mimeType)
                || MimeTypes.AUDIO_DTS_EXPRESS.equals(mimeType)
                || MimeTypes.AUDIO_DTS_X.equals(mimeType);
    }
}
