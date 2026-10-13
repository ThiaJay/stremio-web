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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/**
 * Real pinned StremioVideo HTMLVideo engine in actual TV host, offline original
 * H264/AAC media only. No account, Core dispatch, provider or watched state.
 * This does not prove real programme playback or audible TV speaker quality.
 */
@RunWith(AndroidJUnit4.class)
public final class EnhancedEngineInstrumentedTest {
    private static WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView found = findWebView(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }
    private static String evaluate(Instrumentation instrument, WebView webView,
                                   String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>("");
        instrument.runOnMainSync(() -> webView.evaluateJavascript(script, result -> {
            value.set(result);
            done.countDown();
        }));
        assertTrue("WebView JavaScript timed out", done.await(10, TimeUnit.SECONDS));
        return value.get();
    }
    private static boolean waitFor(Instrumentation instrument, WebView view,
                                   String expression, int waitMs) throws Exception {
        long end = android.os.SystemClock.elapsedRealtime() + waitMs;
        do {
            if ("true".equals(evaluate(instrument, view, expression))) return true;
            Thread.sleep(300);
        } while (android.os.SystemClock.elapsedRealtime() < end);
        return false;
    }

    @Test(timeout = 125000)
    public void pinnedStremioVideoBackendPlaysOriginalMediaWithNightAudio() throws Exception {
        Instrumentation instrument = InstrumentationRegistry.getInstrumentation();
        Intent launch = new Intent(instrument.getTargetContext(), EnhancedTvActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Activity activity = instrument.startActivitySync(launch);
        try {
            AtomicReference<WebView> target = new AtomicReference<>();
            instrument.runOnMainSync(() ->
                target.set(findWebView(activity.getWindow().getDecorView())));
            WebView view = target.get();
            assertNotNull("Actual Enhanced TV WebView missing", view);
            assertTrue("Enhanced React not mounted in actual host",
                waitFor(instrument, view,
                    "location.origin==='https://appassets.androidplatform.net' && " +
                    "location.pathname==='/assets/web/index.html' && " +
                    "Boolean(document.getElementById('app')?.children.length > 0)", 70000));
            assertEquals("true", evaluate(instrument, view,
                "(()=>{const s=document.createElement('script');" +
                "s.src='/assets/web/qa-video-engine.js';document.head.appendChild(s);return true})()"));
            assertTrue("Pinned actual Stremio video backend not ready",
                waitFor(instrument, view,
                    "window.__enhancedBackendQa?.ready===true", 28000));
            assertEquals("true",evaluate(instrument,view,
                "window.__enhancedBackendQa?.backend===true"));
            assertTrue("Real engine start control not focused",
                waitFor(instrument, view,
                    "document.activeElement?.id==='enhanced-real-engine-start'", 6000));
            instrument.runOnMainSync(view::requestFocus);
            instrument.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER);
            assertTrue("Emulated TV remote gesture not received by real engine",
                waitFor(instrument, view,
                    "window.__enhancedBackendQa?.gesture===true", 6000));
            assertTrue("Real backend video and guarded Night Audio on/off not established",
                waitFor(instrument, view,
                    "window.__enhancedBackendQa?.video===true && " +
                    "window.__enhancedBackendQa?.audioActive===true && " +
                    "window.__enhancedBackendQa?.audioOff===true", 25000));
            assertEquals("true", evaluate(instrument, view,
                "window.__enhancedBackendQa?.error===false"));
            assertEquals("true", evaluate(instrument, view,
                "Boolean(document.getElementById('app')?.children.length > 0)"));
        } finally {
            instrument.runOnMainSync(activity::finish);
        }
    }
}
