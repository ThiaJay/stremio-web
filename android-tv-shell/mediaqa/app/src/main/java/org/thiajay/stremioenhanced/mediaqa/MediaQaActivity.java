package org.thiajay.stremioenhanced.mediaqa;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Disposable synthetic media decoder probe, not a Stremio player.
 * This separate Android package has no provider, account or watched access.
 */
public final class MediaQaActivity extends Activity {
    private static final String TAG = "MediaFixtureQA";
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/assets/index.html";
    private static final Set<String> MARKERS = new HashSet<>(Arrays.asList(
        "MEDIAQA_READY_FOR_USER_GESTURE",
        "MEDIAQA_GESTURE_ACCEPTED",
        "MEDIAQA_VIDEO_DECODED_FRAMES_AND_TIME_PASS",
        "MEDIAQA_DECODED_AUDIO_PCM_COMPRESSION_PASS",
        "MEDIAQA_AUDIO_API_UNAVAILABLE",
        "MEDIAQA_VIDEO_FRAME_CALLBACK_UNAVAILABLE",
        "MEDIAQA_LOCAL_FIXTURE_NOT_READY",
        "MEDIAQA_MEDIA_ELEMENT_ERROR",
        "MEDIAQA_USER_GESTURE_PLAYBACK_FAILED",
        "MEDIAQA_AUDIO_GRAPH_INITIALISATION_FAILED",
        "MEDIAQA_VIDEO_DECODE_NOT_OBSERVED",
        "MEDIAQA_AUDIO_PCM_NOT_OBSERVED",
        "MEDIAQA_MAIN_DOCUMENT_FAILED",
        "MEDIAQA_EXTERNAL_REQUEST_BLOCKED"
    ));
    private WebView webView;

    private static WebResourceResponse forbidden() {
        WebResourceResponse response = new WebResourceResponse("text/plain", "UTF-8",
            new ByteArrayInputStream(new byte[0]));
        response.setStatusCodeAndReasonPhrase(403, "Blocked");
        return response;
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .setDomain(HOST).setHttpAllowed(false)
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        webView = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(false);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        final WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setGeolocationEnabled(false);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage entry) {
                // Only exact known outcome identifiers may leave the WebView.
                if (MARKERS.contains(entry.message())) Log.i(TAG, entry.message());
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !HOME.equals(req.getUrl().toString());
            }
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view,
                    WebResourceRequest req) {
                final android.net.Uri uri = req.getUrl();
                boolean local = "https".equalsIgnoreCase(uri.getScheme())
                    && HOST.equalsIgnoreCase(uri.getHost()) && uri.getPort() == -1;
                if (local && ("/assets/index.html".equals(uri.getPath()) ||
                              "/assets/sample.mp4".equals(uri.getPath()))) {
                    WebResourceResponse response = loader.shouldInterceptRequest(uri);
                    return response == null ? forbidden() : response;
                }
                if ("about".equalsIgnoreCase(uri.getScheme())) return null;
                if (!local) Log.i(TAG, "MEDIAQA_EXTERNAL_REQUEST_BLOCKED");
                return forbidden();
            }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest req,
                    android.webkit.WebResourceError error) {
                if (req.isForMainFrame()) Log.i(TAG, "MEDIAQA_MAIN_DOCUMENT_FAILED");
            }
        });
        setContentView(webView, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.loadUrl(HOME);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
