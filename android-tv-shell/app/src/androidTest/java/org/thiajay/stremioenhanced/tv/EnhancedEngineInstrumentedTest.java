package org.thiajay.stremioenhanced.tv;

import android.app.Activity;
import android.app.Instrumentation;
import android.util.Log;
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
    // Exact anonymous QA-stage identifiers only; no raw WebView or player data.
    private static void stage(String code) {
        Log.i("EnhancedEngineQA", "ENGINE_QA_STAGE_" + code);
    }
    private static final String[] FLAGS = {
        "READY", "GESTURE", "BACKEND", "VIDEO",
        "AUDIOACTIVE", "AUDIOOFF", "ERROR"
    };
    private static void captureFixedState(Instrumentation instrument, WebView view) {
        if (view == null) return;
        try {
            String result = evaluate(instrument, view,
                "(()=>{const s=window.__enhancedBackendQa;return s?[" +
                "'ready','gesture','backend','video','audioActive','audioOff','error']" +
                ".map(k=>s[k]===true?'1':'0').join(''):''})()");
            if (result != null && result.matches("\"[01]{7}\"")) {
                for (int i=0;i<FLAGS.length;i++) {
                    if (result.charAt(i+1)=='1') {
                        Log.i("EnhancedEngineQA","ENGINE_QA_FLAG_"+FLAGS[i]);
                    }
                }
            } else {
                stage("STATE_CAPTURE_UNAVAILABLE");
            }
        } catch (Exception ignored) {
            stage("STATE_CAPTURE_UNAVAILABLE");
        }
    }
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
        AtomicReference<WebView> checkedView = new AtomicReference<>();
        try {
            AtomicReference<WebView> target = new AtomicReference<>();
            instrument.runOnMainSync(() ->
                target.set(findWebView(activity.getWindow().getDecorView())));
            WebView view = target.get();
            assertNotNull("Actual Enhanced TV WebView missing", view);
            checkedView.set(view);
            stage("WEBVIEW_PRESENT");
            assertTrue("Enhanced React not mounted in actual host",
                waitFor(instrument, view,
                    "location.origin==='https://appassets.androidplatform.net' && " +
                    "location.pathname==='/assets/web/index.html' && " +
                    "Boolean(document.getElementById('app')?.children.length > 0)", 70000));
            stage("ENHANCED_REACT_MOUNTED");
            assertEquals("true", evaluate(instrument, view,
                "(()=>{const s=document.createElement('script');" +
                "s.src='/assets/web/qa-video-engine.js';document.head.appendChild(s);return true})()"));
            stage("SCRIPT_REQUESTED");
            assertTrue("Pinned actual Stremio video backend not ready",
                waitFor(instrument, view,
                    "window.__enhancedBackendQa?.ready===true", 28000));
            stage("SCRIPT_READY");
            assertEquals("true",evaluate(instrument,view,
                "window.__enhancedBackendQa?.backend===true"));
            stage("VIDEO_BACKEND_READY");
            // The Android Activity toolbar can reclaim native focus after
            // React mount. Restore WebView + actual DOM button focus *before*
            // the genuine remote gesture, without .click() or media.play().
            instrument.runOnMainSync(view::requestFocus);
            assertEquals("Real engine start control not focused",
                "true", evaluate(instrument,view,
                    "(()=>{const b=document.getElementById('enhanced-real-engine-start');" +
                    "b?.focus();return !!b && document.activeElement===b})()"));
            stage("REMOTE_FOCUSED");
            Thread.sleep(350);
            instrument.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER);
            boolean gesture = waitFor(instrument,view,
                "window.__enhancedBackendQa?.gesture===true",3000);
            if (!gesture) {
                // One bounded recovery for a transient native-focus handoff;
                // a real second D-pad press remains mandatory if first failed.
                instrument.runOnMainSync(view::requestFocus);
                assertEquals("Real engine remote focus unavailable on retry",
                    "true", evaluate(instrument,view,
                        "(()=>{const b=document.getElementById('enhanced-real-engine-start');" +
                        "b?.focus();return !!b && document.activeElement===b})()"));
                Thread.sleep(350);
                instrument.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER);
                gesture = waitFor(instrument,view,
                    "window.__enhancedBackendQa?.gesture===true",4000);
            }
            assertTrue("Emulated TV remote gesture not received by real engine", gesture);
            stage("REMOTE_GESTURE_ACCEPTED");
            assertTrue("Real backend video and guarded Night Audio on/off not established",
                waitFor(instrument, view,
                    "window.__enhancedBackendQa?.video===true && " +
                    "window.__enhancedBackendQa?.audioActive===true && " +
                    "window.__enhancedBackendQa?.audioOff===true", 25000));
            stage("VIDEO_NIGHT_AUDIO_CONFIRMED");
            assertEquals("true", evaluate(instrument, view,
                "window.__enhancedBackendQa?.error===false"));
            assertEquals("true", evaluate(instrument, view,
                "Boolean(document.getElementById('app')?.children.length > 0)"));
            stage("APP_REMAINED_MOUNTED");
            stage("ENGINE_QA_COMPLETE");
        } finally {
            captureFixedState(instrument, checkedView.get());
            instrument.runOnMainSync(activity::finish);
        }
    }
}
