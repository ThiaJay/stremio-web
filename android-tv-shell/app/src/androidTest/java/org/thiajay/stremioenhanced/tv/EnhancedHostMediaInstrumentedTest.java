package org.thiajay.stremioenhanced.tv;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
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

            assertTrue("Actual embedded Enhanced React app did not mount",
                awaitBoolean(instrumentation, webView,
                    "location.origin==='https://appassets.androidplatform.net' && " +
                    "location.pathname==='/assets/web/index.html' && " +
                    "Boolean(document.getElementById('app')?.children.length > 0)",
                    WAIT_MS));

            byte[] bytes;
            try (InputStream input = instrumentation.getContext().getAssets()
                    .open("host_media.js")) {
                bytes = input.readAllBytes();
            }
            assertTrue("Instrumentation fixture absent or oversized",
                       bytes.length > 1500 && bytes.length < 16000);
            String fixtureScript = new String(bytes, StandardCharsets.UTF_8);
            instrumentation.runOnMainSync(webView::requestFocus);
            evaluate(instrumentation, webView, fixtureScript);

            assertTrue("Original locally generated video metadata was not accepted",
                awaitBoolean(instrumentation, webView,
                    "window.__enhancedHostQa?.ready===true", 30000));
            assertTrue("Synthetic start button has no WebView keyboard focus",
                awaitBoolean(instrumentation, webView,
                    "document.activeElement?.id==='enhanced-host-qa-start'", 5000));

            // Real hardware-key dispatch to a focused HTML button, not .click().
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER);
            assertTrue("Real D-pad gesture did not reach the WebView",
                awaitBoolean(instrumentation, webView,
                    "window.__enhancedHostQa?.gesture===true", 6000));
            assertTrue("Actual decoded video frames or compressed PCM unverified",
                awaitBoolean(instrumentation, webView,
                    "window.__enhancedHostQa?.video===true && " +
                    "window.__enhancedHostQa?.audio===true", 22000));
            assertEquals("true", evaluate(instrumentation, webView,
                "window.__enhancedHostQa?.error===false"));
            assertEquals("true", evaluate(instrumentation, webView,
                "Boolean(document.getElementById('app')?.children.length > 0)"));
        } finally {
            instrumentation.runOnMainSync(activity::finish);
        }
    }
}
