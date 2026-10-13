package org.thiajay.stremioenhanced.tv;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** An opt-in direct-HTTPS media gate, not a rights or watched-history authority. */
public final class NativeSourcePolicy {
    private NativeSourcePolicy() { }

    public static boolean isEligible(String url) {
        if (url == null || url.isEmpty() || url.length() > 4096 ||
                !url.equals(url.trim()) || !url.startsWith("https://")) return false;
        for (int i = 0; i < url.length(); i++) {
            final char c = url.charAt(i);
            if (c <= 0x20 || c == 0x7f || c == '\\') return false;
        }
        try {
            final URI u = new URI(url);
            if (!u.isAbsolute() || !"https".equals(u.getScheme()) ||
                    u.getUserInfo() != null || u.getRawFragment() != null ||
                    (u.getPort() != -1 && u.getPort() != 443) ||
                    u.getHost() == null || u.getHost().isEmpty()) return false;
            final String host = u.getHost().toLowerCase(Locale.ROOT);
            if (host.length() > 253 || !host.contains(".") ||
                    host.endsWith(".local") || host.endsWith(".lan") ||
                    host.endsWith(".internal") || host.endsWith(".localhost") ||
                    host.endsWith(".home") || host.endsWith(".test") ||
                    host.endsWith(".invalid") || host.endsWith(".onion") ||
                    host.matches("[0-9.]+") || host.contains(":") ||
                    host.startsWith(".") || host.endsWith(".")) return false;
            final String[] labels = host.split("\\.", -1);
            for (String label : labels) {
                if (label.isEmpty() || label.length() > 63 ||
                        label.startsWith("-") || label.endsWith("-") ||
                        !label.matches("[a-z0-9-]+")) return false;
            }
            final String path = u.getRawPath();
            return path != null && path.startsWith("/") && path.length() > 1;
        } catch (URISyntaxException | IllegalArgumentException e) {
            return false;
        }
    }
}
