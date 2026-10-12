package org.thiajay.stremioenhanced.tv;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** Pure source-independent navigational constraint. Not a URL whitelist for addon fetches. */
public final class NavigationPolicy {
    public static final String HOST = "appassets.androidplatform.net";
    public static final String APP_PATH = "/assets/web/";
    public static final String HOME = "https://" + HOST + APP_PATH + "index.html";

    private NavigationPolicy() { }

    public static boolean isInternalNavigation(String url) {
        if (url == null || url.length() > 4096) return false;
        try {
            URI u = new URI(url);
            if (!"https".equalsIgnoreCase(u.getScheme()) || u.getUserInfo() != null ||
                    u.getPort() != -1 || u.getHost() == null ||
                    !HOST.equals(u.getHost().toLowerCase(Locale.ROOT))) return false;
            String rawPath = u.getRawPath();
            if (rawPath == null || !rawPath.startsWith(APP_PATH) ||
                    rawPath.indexOf('\\') >= 0 || rawPath.contains("%") ||
                    rawPath.contains("/../") || rawPath.endsWith("/..")) return false;
            // Only one permitted top-level HTML document. React uses hash routes.
            return (APP_PATH + "index.html").equals(rawPath);
        } catch (URISyntaxException | IllegalArgumentException e) {
            return false;
        }
    }
}
