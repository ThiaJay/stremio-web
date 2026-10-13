package org.thiajay.stremioenhanced.tv;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/**
 * Actual Enhanced TV host, real WebView decoder, original offline media.
 * Fixture JavaScript exists solely in this instrumentation test APK. It does
 * not call a Stremio addon, authenticate, select an ordinary stream or alter
 * watched state. This is NOT acceptance of the production player adapter.
 */
@RunWith(AndroidJUnit4.class)
public final class EnhancedHostMediaInstrumentedTest {
    private static final int WAIT_MS = 75000;
    // Only fixed, anonymous instrumentation milestones are written to logcat.
    private static void stage(String code) {
        Log.i("EnhancedCoreQA", "CORE_QA_STAGE_" + code);
    }

    private static WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView result = findWebView(group.getChildAt(i));
                if (result != null) return result;
            }
        }
        return null;
    }

    private static String evaluate(Instrumentation instrumentation, WebView view,
                                   String expression) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>("");
        instrumentation.runOnMainSync(() -> view.evaluateJavascript(expression, result -> {
            value.set(result);
            done.countDown();
        }));
        assertTrue("Javascript response timed out", done.await(10, TimeUnit.SECONDS));
        return value.get();
    }

    private static boolean awaitBoolean(Instrumentation instrumentation, WebView view,
                                        String expression, int waitMs) throws Exception {
        long deadline = android.os.SystemClock.elapsedRealtime() + waitMs;
        do {
            if ("true".equals(evaluate(instrumentation, view, expression))) return true;
            Thread.sleep(350);
        } while (android.os.SystemClock.elapsedRealtime() < deadline);
        return false;
    }

    @Test(timeout = 140000)
    public void originalVideoAndPcmDecodeInsideActualEnhancedHost() throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Intent launch = new Intent(instrumentation.getTargetContext(),
                                   EnhancedTvActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Activity activity = instrumentation.startActivitySync(launch);
        try {
            final AtomicReference<WebView> target = new AtomicReference<>();
            instrumentation.runOnMainSync(() ->
                target.set(findWebView(activity.getWindow().getDecorView())));
            WebView webView = target.get();
            assertNotNull("Actual Enhanced TV host WebView is absent", webView);
            stage("HOST_WEBVIEW_PRESENT");

            assertTrue("Actual embedded Enhanced React app did not mount",
                awaitBoolean(instrumentation, webView,
                    "location.origin==='https://appassets.androidplatform.net' && " +
                    "location.pathname==='/assets/web/index.html' && " +
                    "Boolean(document.getElementById('app')?.children.length > 0)",
                    WAIT_MS));
            stage("HOST_REACT_MOUNTED");

            byte[] bytes;
            try (InputStream input = instrumentation.getContext().getAssets()
                    .open("host_media.js")) {
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                byte[] chunk = new byte[4096];
                int count;
                while ((count = input.read(chunk)) >= 0) {
                    assertTrue("Instrumentation source unexpectedly large",
                               output.size() + count < 16000);
                    output.write(chunk, 0, count);
                }
                bytes = output.toByteArray();
            }
            assertTrue("Instrumentation fixture absent or oversized",
                       bytes.length > 1500 && bytes.length < 16000);
            String fixtureScript = new String(bytes, StandardCharsets.UTF_8);
            instrumentation.runOnMainSync(webView::requestFocus);
            evaluate(instrumentation, webView, fixtureScript);

            assertTrue("Original locally generated video metadata was not accepted",
                awaitBoolean(instrumentation, webView,
                    "window.__enhancedHostQa?.ready===true", 30000));
            stage("HOST_READY");
            // Restore native and HTML focus after the asynchronous React boot.
            // A genuine remote key still has to initiate playback.
            instrumentation.runOnMainSync(webView::requestFocus);
            assertTrue("Host QA start control cannot receive WebView keyboard focus",
                awaitBoolean(instrumentation, webView,
                    "(()=>{const b=document.getElementById('enhanced-host-qa-start');" +
                    "if(!b||b.disabled)return false;b.focus();return document.activeElement===b})()",
                    5000));
            stage("HOST_BUTTON_FOCUSED");

            // Real hardware-key dispatch to a focused HTML button, not .click().
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER);
            assertTrue("Real D-pad gesture did not reach the WebView",
                awaitBoolean(instrumentation, webView,
                    "window.__enhancedHostQa?.gesture===true", 6000));
            stage("HOST_REMOTE_KEY_ACCEPTED");
            assertTrue("Actual decoded video frames or compressed PCM unverified",
                awaitBoolean(instrumentation, webView,
                    "window.__enhancedHostQa?.video===true && " +
                    "window.__enhancedHostQa?.audio===true", 22000));
            stage("HOST_MEDIA_PCM_VERIFIED");
            assertEquals("true", evaluate(instrumentation, webView,
                "window.__enhancedHostQa?.error===false"));
            assertEquals("true", evaluate(instrumentation, webView,
                "Boolean(document.getElementById('app')?.children.length > 0)"));
            stage("HOST_TEST_COMPLETE");
        } finally {
            instrumentation.runOnMainSync(activity::finish);
        }
    }
}
