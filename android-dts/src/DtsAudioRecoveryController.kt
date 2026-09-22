package com.stremio.common.players

import androidx.media3.common.C
import androidx.media3.common.PlaybackException
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import io.github.anilbeesetti.nextlib.media3ext.ffdecoder.DecoderManager
import io.github.anilbeesetti.nextlib.media3ext.ffdecoder.DecoderMode

@UnstableApi
internal class DtsAudioRecoveryController(
    private val decoderManager: DecoderManager,
    private val trackSelector: DefaultTrackSelector,
) {
    private val policy = DtsAudioRecoveryPolicy()
    private var configuredTunnelingEnabled = false

    fun onTracksChanged(
        tracks: Tracks,
        audioPassthroughEnabled: Boolean,
        dtsPassthroughKnownGood: Boolean = false,
    ): Boolean {
        configuredTunnelingEnabled = audioPassthroughEnabled
        return apply(
            policy.onSelectedAudioMimeChanged(
                selectedAudioMime(tracks),
                audioPassthroughEnabled,
                dtsPassthroughKnownGood,
            ),
        )
    }

    fun onPlayerError(error: PlaybackException): Boolean =
        apply(policy.onPlayerError(error.errorCode))

    fun onPassthroughRouteRejected(): Boolean =
        apply(policy.onPassthroughRouteRejected())

    fun reset(): Boolean = apply(policy.reset())

    private fun apply(decision: DtsAudioRecoveryDecision): Boolean {
        return when (decision) {
            DtsAudioRecoveryDecision.NONE -> false
            DtsAudioRecoveryDecision.USE_AUTO -> {
                decoderManager.selectAudioDecoder(DecoderMode.AUTO)
                setTunnelingEnabled(configuredTunnelingEnabled)
                true
            }
            DtsAudioRecoveryDecision.USE_FFMPEG -> {
                setTunnelingEnabled(false)
                decoderManager.selectAudioDecoder(DecoderMode.FFMPEG)
                true
            }
        }
    }

    private fun setTunnelingEnabled(enabled: Boolean) {
        trackSelector.setParameters(
            trackSelector.buildUponParameters()
                .setTunnelingEnabled(enabled)
                .build(),
        )
    }

    companion object {
        fun selectedAudioMime(tracks: Tracks): String? {
            for (group in tracks.groups) {
                if (group.type != C.TRACK_TYPE_AUDIO || !group.isSelected) continue
                for (index in 0 until group.length) {
                    if (group.isTrackSelected(index)) {
                        return group.getTrackFormat(index).sampleMimeType
                    }
                }
            }
            return null
        }
    }
}
