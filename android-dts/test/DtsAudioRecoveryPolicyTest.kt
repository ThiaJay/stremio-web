package com.stremio.common.players

import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import org.junit.Assert.assertEquals
import org.junit.Test

class DtsAudioRecoveryPolicyTest {
    private val policy = DtsAudioRecoveryPolicy()

    @Test
    fun dtsDefaultsToFfmpegWhenRouteIsNotKnownGood() {
        assertEquals(
            DtsAudioRecoveryDecision.USE_FFMPEG,
            policy.onSelectedAudioMimeChanged(
                MimeTypes.AUDIO_DTS,
                audioPassthroughEnabled = true,
                dtsPassthroughKnownGood = false,
            ),
        )
    }

    @Test
    fun dtsWithoutPassthroughUsesFfmpeg() {
        assertEquals(
            DtsAudioRecoveryDecision.USE_FFMPEG,
            policy.onSelectedAudioMimeChanged(MimeTypes.AUDIO_DTS, false),
        )
    }

    @Test
    fun allDtsVariantsUseTheSameSafeDefault() {
        listOf(
            MimeTypes.AUDIO_DTS,
            MimeTypes.AUDIO_DTS_HD,
            MimeTypes.AUDIO_DTS_EXPRESS,
            MimeTypes.AUDIO_DTS_X,
        ).forEach { mime ->
            val p = DtsAudioRecoveryPolicy()
            assertEquals(
                DtsAudioRecoveryDecision.USE_FFMPEG,
                p.onSelectedAudioMimeChanged(
                    mime,
                    audioPassthroughEnabled = true,
                    dtsPassthroughKnownGood = false,
                ),
            )
        }
    }

    @Test
    fun explicitlyKnownGoodDtsPassthroughStaysAutomatic() {
        assertEquals(
            DtsAudioRecoveryDecision.NONE,
            policy.onSelectedAudioMimeChanged(
                MimeTypes.AUDIO_DTS_HD,
                audioPassthroughEnabled = true,
                dtsPassthroughKnownGood = true,
            ),
        )
    }

    @Test
    fun knownGoodPassthroughStillFallsBackAfterAudioFailure() {
        policy.onSelectedAudioMimeChanged(
            MimeTypes.AUDIO_DTS_HD,
            audioPassthroughEnabled = true,
            dtsPassthroughKnownGood = true,
        )
        assertEquals(
            DtsAudioRecoveryDecision.USE_FFMPEG,
            policy.onPlayerError(PlaybackException.ERROR_CODE_AUDIO_TRACK_WRITE_FAILED),
        )
    }

    @Test
    fun unrelatedErrorsDoNotChangeKnownGoodDtsPassthrough() {
        policy.onSelectedAudioMimeChanged(
            MimeTypes.AUDIO_DTS,
            audioPassthroughEnabled = true,
            dtsPassthroughKnownGood = true,
        )
        assertEquals(
            DtsAudioRecoveryDecision.NONE,
            policy.onPlayerError(PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED),
        )
    }

    @Test
    fun nonDtsAudioIsUntouched() {
        assertEquals(
            DtsAudioRecoveryDecision.NONE,
            policy.onSelectedAudioMimeChanged(MimeTypes.AUDIO_E_AC3, false),
        )
    }

    @Test
    fun leavingDtsRestoresAutomaticAudioSelection() {
        policy.onSelectedAudioMimeChanged(MimeTypes.AUDIO_DTS, false)
        assertEquals(
            DtsAudioRecoveryDecision.USE_AUTO,
            policy.onSelectedAudioMimeChanged(MimeTypes.AUDIO_AAC, false),
        )
    }

    @Test
    fun routeRejectionRecoversKnownGoodPassthrough() {
        policy.onSelectedAudioMimeChanged(
            MimeTypes.AUDIO_DTS,
            audioPassthroughEnabled = true,
            dtsPassthroughKnownGood = true,
        )
        assertEquals(
            DtsAudioRecoveryDecision.USE_FFMPEG,
            policy.onPassthroughRouteRejected(),
        )
    }

    @Test
    fun knownGoodRouteRestoresAutoAfterSafePcmFallback() {
        policy.onSelectedAudioMimeChanged(
            MimeTypes.AUDIO_DTS_HD,
            audioPassthroughEnabled = true,
            dtsPassthroughKnownGood = false,
        )
        assertEquals(
            DtsAudioRecoveryDecision.USE_AUTO,
            policy.onSelectedAudioMimeChanged(
                MimeTypes.AUDIO_DTS_HD,
                audioPassthroughEnabled = true,
                dtsPassthroughKnownGood = true,
            ),
        )
    }
}
