package org.thiajay.stremioenhanced.tv;

import org.junit.Test;
import static org.junit.Assert.*;

public class NavigationPolicyTest {
    @Test public void localHomeAndHashRoutesAllowed() {
        assertTrue(NavigationPolicy.isInternalNavigation(NavigationPolicy.HOME));
        assertTrue(NavigationPolicy.isInternalNavigation(NavigationPolicy.HOME + "#/library"));
        assertTrue(NavigationPolicy.isInternalNavigation(NavigationPolicy.HOME + "#/player/tt123"));
    }
    @Test public void remoteNavigationIsNeverAllowed() {
        assertFalse(NavigationPolicy.isInternalNavigation("https://stremio.com/sign-in"));
        assertFalse(NavigationPolicy.isInternalNavigation("https://example.com/?token=secret"));
        assertFalse(NavigationPolicy.isInternalNavigation("https://appassets.androidplatform.net.evil.com/assets/web/index.html"));
        assertFalse(NavigationPolicy.isInternalNavigation("http://appassets.androidplatform.net/assets/web/index.html"));
    }
    @Test public void localSpoofAndTraversalBlocked() {
        assertFalse(NavigationPolicy.isInternalNavigation("https://user@appassets.androidplatform.net/assets/web/index.html"));
        assertFalse(NavigationPolicy.isInternalNavigation("https://appassets.androidplatform.net:444/assets/web/index.html"));
        assertFalse(NavigationPolicy.isInternalNavigation("https://appassets.androidplatform.net/assets/web/../web/index.html"));
        assertFalse(NavigationPolicy.isInternalNavigation("https://appassets.androidplatform.net/assets/web/%2e%2e/index.html"));
        assertFalse(NavigationPolicy.isInternalNavigation("https://appassets.androidplatform.net/assets/web/worker.js"));
        assertFalse(NavigationPolicy.isInternalNavigation("file:///android_asset/web/index.html"));
    }
    @Test public void invalidInputFailsClosed() {
        assertFalse(NavigationPolicy.isInternalNavigation(null));
        assertFalse(NavigationPolicy.isInternalNavigation(""));
        assertFalse(NavigationPolicy.isInternalNavigation("https://appassets.androidplatform.net/assets/web/index.html\nhttps://evil.com"));
    }
}
