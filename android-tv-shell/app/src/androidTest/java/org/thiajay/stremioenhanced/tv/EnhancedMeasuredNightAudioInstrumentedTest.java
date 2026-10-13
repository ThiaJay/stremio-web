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
 * Test-only exact StremioVideo Night Audio graph inspection on generated media.
 * The production Enhanced TV APK, account and viewing state remain unchanged.
 * No real provider streams or hardware speaker output are used.
 */
@RunWith(AndroidJUnit4.class)
public final class EnhancedMeasuredNightAudioInstrumentedTest {
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

    private static String evaluate(Instrumentation instrumentation, WebView view,
                                   String expression) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>("");
        instrumentation.runOnMainSync(() -> view.evaluateJavascript(expression, value -> {
            result.set(value);
            latch.countDown();
        }));
        assertTrue("MEASURED_NIGHT_QA_JS_CALLBACK_TIMEOUT",
            latch.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private static boolean waitFor(Instrumentation instrumentation, WebView view,
                                   String expression, int timeoutMs) throws Exception {
        long deadline = android.os.SystemClock.elapsedRealtime() + timeoutMs;
        while (android.os.SystemClock.elapsedRealtime() < deadline) {
            if ("true".equals(evaluate(instrumentation, view, expression))) return true;
            Thread.sleep(250);
        }
        return false;
    }

    @Test(timeout = 130000)
    public void actualStremioNightAudioMustMeasureCompressionThenSwitchOff() throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Intent launch = new Intent(instrumentation.getTargetContext(),
            EnhancedTvActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Activity activity = instrumentation.startActivitySync(launch);
        try {
            AtomicReference<WebView> found = new AtomicReference<>();
            instrumentation.runOnMainSync(() ->
                found.set(findWebView(activity.getWindow().getDecorView())));
            WebView realView = found.get();
            assertNotNull("MEASURED_NIGHT_QA_REAL_WEBVIEW_MISSING", realView);

            assertTrue("MEASURED_NIGHT_QA_ENHANCED_APP_NOT_MOUNTED",
                waitFor(instrumentation, realView,
                    "location.origin==='https://appassets.androidplatform.net' && " +
                    "location.pathname==='/assets/web/index.html' && " +
                    "Boolean(document.getElementById('app')?.children.length>0)", 70000));
            assertEquals("true", evaluate(instrumentation, realView,
                "(()=>{const s=document.createElement('script');" +
                "s.src='/assets/web/qa-video-engine-measured.js';" +
                "document.head.appendChild(s);return true})()"));
            assertTrue("MEASURED_NIGHT_QA_REAL_PLAYER_NOT_READY",
                waitFor(instrumentation, realView,
                    "window.__enhancedMeasuredNightQa?.ready===true", 30000));
            assertEquals("true", evaluate(instrumentation, realView,
                "window.__enhancedMeasuredNightQa?.backend===true"));
            assertTrue("MEASURED_NIGHT_QA_BUTTON_NOT_FOCUSED",
                waitFor(instrumentation, realView,
                    "document.activeElement?.id==='enhanced-measured-night-start'", 5000));
            instrumentation.runOnMainSync(realView::requestFocus);
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER);
            assertTrue("MEASURED_NIGHT_QA_NO_TRUSTED_REMOTE_GESTURE",
                waitFor(instrumentation, realView,
                    "window.__enhancedMeasuredNightQa?.gesture===true", 6000));
            assertTrue("MEASURED_NIGHT_QA_NO_MEASURED_COMPRESSED_PCM_OR_OFF",
                waitFor(instrumentation, realView,
                    "window.__enhancedMeasuredNightQa?.complete===true", 25000));
            for (String item : new String[] {"video", "requested", "measured", "off", "complete"}) {
                assertEquals("MEASURED_NIGHT_QA_REQUIRED_" + item,
                    "true", evaluate(instrumentation, realView,
                        "window.__enhancedMeasuredNightQa?." + item + "===true"));
            }
            assertEquals("MEASURED_NIGHT_QA_HAS_ERROR", "true",
                evaluate(instrumentation, realView,
                    "window.__enhancedMeasuredNightQa?.error===false"));
            assertEquals("MEASURED_NIGHT_QA_ENHANCED_REACT_LOST", "true",
                evaluate(instrumentation, realView,
                    "Boolean(document.getElementById('app')?.children.length>0)"));
        } finally {
            instrumentation.runOnMainSync(activity::finish);
        }
    }
}
