package org.thiajay.stremioenhanced.tv;

import android.app.Activity;
import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;

/**
 * Independently installed TV host for our pinned Stremio Enhanced Web build.
 * No native account bridge, secrets, external intents, autoplay, telemetry or
 * cross-process watched-state mutations. Native playback is NOT yet accepted.
 */
public final class EnhancedTvActivity extends Activity {
    private WebView webView;
    private LinearLayout root;
    private TextView status;
    private WebViewAssetLoader assets;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        assets = new WebViewAssetLoader.Builder()
            .setDomain(NavigationPolicy.HOST)
            .setHttpAllowed(false)
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(20, 19, 33));
        status = new TextView(this);
        status.setTextColor(Color.WHITE);
        status.setPadding(16, 6, 8, 6);
        status.setText(R.string.unofficial);
        root.addView(status, new LinearLayout.LayoutParams(-1, -2));
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        for (int i = 0; i < 4; i++) {
            final int action = i;
            Button button = new Button(this);
            int[] labels = {R.string.go_back, R.string.go_home, R.string.reload, R.string.exit};
            button.setText(labels[i]);
            button.setContentDescription(getString(labels[i]));
            button.setFocusable(true);
            button.setOnClickListener(v -> {
                if (action == 0) back();
                else if (action == 1) safeLoadHome();
                else if (action == 2) { if (webView != null) webView.reload(); else createWebView(); }
                else finish();
            });
            toolbar.addView(button, new LinearLayout.LayoutParams(0, -2, 1));
        }
        root.addView(toolbar, new LinearLayout.LayoutParams(-1, -2));
        setContentView(root);
        createWebView();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        if (webView != null) { root.removeView(webView); webView.destroy(); }
        webView = new WebView(this);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.setBackgroundColor(Color.rgb(20, 19, 33));
        WebView.setWebContentsDebuggingEnabled(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true); // Required by the original Stremio Web client.
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setGeolocationEnabled(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                if (NavigationPolicy.isInternalNavigation(request.getUrl().toString())) return false;
                status.setText(R.string.blocked_link);
                return true;
            }
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                if ("https".equalsIgnoreCase(scheme)) {
                    if (NavigationPolicy.HOST.equalsIgnoreCase(request.getUrl().getHost())) {
                        WebResourceResponse result = assets.shouldInterceptRequest(request.getUrl());
                        return result == null ? forbiddenResponse() : result;
                    }
                    // HTTPS addon/media requests remain controlled by Stremio Web.
                    return null;
                }
                if ("about".equalsIgnoreCase(scheme)) return null;
                return forbiddenResponse();
            }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) status.setText(R.string.load_failed);
            }
            @Override
            public boolean onRenderProcessGone(WebView view,
                                               android.webkit.RenderProcessGoneDetail detail) {
                root.removeView(view);
                view.destroy();
                webView = null;
                status.setText(R.string.render_failed);
                return true;
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                if (NavigationPolicy.isInternalNavigation(url)) status.setText(R.string.ready);
            }
        });
        root.addView(webView, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        status.setText(R.string.start);
        safeLoadHome();
    }

    private static WebResourceResponse forbiddenResponse() {
        WebResourceResponse blocked = new WebResourceResponse("text/plain", "UTF-8",
            new ByteArrayInputStream(new byte[0]));
        blocked.setStatusCodeAndReasonPhrase(403, "Blocked");
        return blocked;
    }

    private void safeLoadHome() {
        if (webView == null) createWebView();
        else webView.loadUrl(NavigationPolicy.HOME);
    }

    private void back() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else finish();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_ESCAPE) {
            back(); return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }
    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }
    @Override
    protected void onDestroy() {
        if (webView != null) { root.removeView(webView); webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
