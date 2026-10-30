package online.mypersonas.owner;

import java.net.URI;
import java.util.Locale;

final class OwnerUrlPolicy {
    static boolean allowed(String url, boolean debug) {
        if (url == null || url.contains("\\")) return false;
        try {
            URI uri = new URI(url);
            if (uri.getRawUserInfo() != null || uri.getHost() == null) return false;
            String host = uri.getHost().toLowerCase(Locale.ROOT);
            if ("https".equals(uri.getScheme()) && "mypersonas.online".equals(host)) {
                return uri.getPort() == -1 || uri.getPort() == 443;
            }
            return debug && "http".equals(uri.getScheme()) && uri.getPort() > 0 && uri.getPort() <= 65535
                && ("localhost".equals(host) || "127.0.0.1".equals(host) || "10.0.2.2".equals(host));
        } catch (Exception invalid) { return false; }
    }
}
