package com.stremio.common.players

import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException

internal enum class DtsAudioRecoveryDecision {
    NONE,
    USE_AUTO,
    USE_FFMPEG,
}

internal class DtsAudioRecoveryPolicy {
    private var selectedDts = false
    private var ffmpegForced = false

    fun onSelectedAudioMimeChanged(
        mimeType: String?,
        audioPassthroughEnabled: Boolean,
        dtsPassthroughKnownGood: Boolean = false,
    ): DtsAudioRecoveryDecision {
        selectedDts = isDts(mimeType)
        if (!selectedDts) {
            return if (ffmpegForced) {
                ffmpegForced = false
                DtsAudioRecoveryDecision.USE_AUTO
            } else {
                DtsAudioRecoveryDecision.NONE
            }
        }

        return if (!audioPassthroughEnabled || !dtsPassthroughKnownGood) {
            forceFfmpeg()
        } else if (ffmpegForced) {
            ffmpegForced = false
            DtsAudioRecoveryDecision.USE_AUTO
        } else {
            DtsAudioRecoveryDecision.NONE
        }
    }

    fun onPlayerError(errorCode: Int): DtsAudioRecoveryDecision {
        if (!selectedDts || ffmpegForced || !isAudioOrDecoderFailure(errorCode)) {
            return DtsAudioRecoveryDecision.NONE
        }
        return forceFfmpeg()
    }

    fun onPassthroughRouteRejected(): DtsAudioRecoveryDecision =
        if (selectedDts) forceFfmpeg() else DtsAudioRecoveryDecision.NONE

    fun reset(): DtsAudioRecoveryDecision {
        selectedDts = false
        return if (ffmpegForced) {
            ffmpegForced = false
            DtsAudioRecoveryDecision.USE_AUTO
        } else {
            DtsAudioRecoveryDecision.NONE
        }
    }

    private fun forceFfmpeg(): DtsAudioRecoveryDecision {
        if (ffmpegForced) return DtsAudioRecoveryDecision.NONE
        ffmpegForced = true
        return DtsAudioRecoveryDecision.USE_FFMPEG
    }

    companion object {
        fun isDts(mimeType: String?): Boolean =
            mimeType == MimeTypes.AUDIO_DTS ||
                mimeType == MimeTypes.AUDIO_DTS_HD ||
                mimeType == MimeTypes.AUDIO_DTS_EXPRESS ||
                mimeType == MimeTypes.AUDIO_DTS_X

        private fun isAudioOrDecoderFailure(errorCode: Int): Boolean =
            errorCode == PlaybackException.ERROR_CODE_DECODER_INIT_FAILED ||
                errorCode == PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED ||
                errorCode == PlaybackException.ERROR_CODE_DECODING_FAILED ||
                errorCode == PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES ||
                errorCode == PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED ||
                errorCode == PlaybackException.ERROR_CODE_AUDIO_TRACK_INIT_FAILED ||
                errorCode == PlaybackException.ERROR_CODE_AUDIO_TRACK_WRITE_FAILED ||
                errorCode == PlaybackException.ERROR_CODE_AUDIO_TRACK_OFFLOAD_INIT_FAILED ||
                errorCode == PlaybackException.ERROR_CODE_AUDIO_TRACK_OFFLOAD_WRITE_FAILED
    }
}
