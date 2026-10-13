package org.thiajay.stremioenhanced.tv;

import org.junit.Test;
import static org.junit.Assert.*;

public class NativeSourcePolicyTest {
    @Test public void permitsDirectHttpsMediaOnPublicHosts() {
        assertTrue(NativeSourcePolicy.isEligible("https://media.example.org/movie.mp4"));
        assertTrue(NativeSourcePolicy.isEligible("https://cdn.example.com:443/hls/master.m3u8?session=fixture"));
        assertTrue(NativeSourcePolicy.isEligible("https://stream.example.net/dash/manifest.mpd"));
    }

    @Test public void rejectsNonHttpsLocalSecretsAndInvalidSources() {
        String[] invalid = {
            "http://media.example.org/movie.mp4", "https://localhost/a.mp4",
            "https://example.local/movie.mp4", "https://192.168.1.2/stream",
            "https://127.0.0.1/file", "https://[::1]/file", "https://dns.test/video",
            "https://host.invalid/video", "https://user:pass@media.example.org/movie.mp4",
            "https://media.example.org:8443/video", "file:///etc/passwd", "content://any/media",
            "magnet:?xt=urn:btih:1234", "javascript:alert(1)", "https://example.org/",
            "https://example.org", " https://media.example.org/a",
            "https://media.example.org/a#secret", "https://media.example.org/a\nb"
        };
        for (String candidate : invalid) {
            assertFalse(candidate, NativeSourcePolicy.isEligible(candidate));
        }
    }

    @Test public void rejectsUnknownOrOverlongSources() {
        assertFalse(NativeSourcePolicy.isEligible(null));
        assertFalse(NativeSourcePolicy.isEligible(""));
        assertFalse(NativeSourcePolicy.isEligible("https://media.example.org/" + "a".repeat(4100)));
    }
}
