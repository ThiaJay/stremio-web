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
 * Original local media and VTT subtitle selection in the ACTUAL pinned
 * StremioVideo backend plus Enhanced subtitle policy inside the TV WebView.
 * Synthetic language metadata is not an audio-language detector. There is no
 * account, addon, provider, Core playback history or personal Fire TV.
 */
@RunWith(AndroidJUnit4.class)
public final class EnhancedSubtitleInstrumentedTest {
    private static WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup)view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView found = findWebView(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }

    private static String evaluate(Instrumentation instrumentation, WebView view,
                                   String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>("");
        instrumentation.runOnMainSync(() -> view.evaluateJavascript(script, result -> {
            value.set(result);
            latch.countDown();
        }));
        assertTrue("WebView response timeout", latch.await(10, TimeUnit.SECONDS));
        return value.get();
    }

    private static boolean waitFor(Instrumentation instrumentation, WebView view,
                                   String expression, int maximumMs) throws Exception {
        long deadline = android.os.SystemClock.elapsedRealtime() + maximumMs;
        do {
            if ("true".equals(evaluate(instrumentation, view, expression))) return true;
            Thread.sleep(280);
        } while (android.os.SystemClock.elapsedRealtime() < deadline);
        return false;
    }

    @Test(timeout = 125000)
    public void actualVideoBackendRendersAndClearsEnglishSubtitles() throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Intent intent = new Intent(instrumentation.getTargetContext(),EnhancedTvActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Activity activity = instrumentation.startActivitySync(intent);
        try {
            AtomicReference<WebView> target = new AtomicReference<>();
            instrumentation.runOnMainSync(() ->
                target.set(findWebView(activity.getWindow().getDecorView())));
            WebView view = target.get();
            assertNotNull("Original Enhanced host WebView absent", view);
            assertTrue("Actual Enhanced React was not visible",
                waitFor(instrumentation,view,
                    "location.origin==='https://appassets.androidplatform.net' && " +
                    "location.pathname==='/assets/web/index.html' && " +
                    "Boolean(document.getElementById('app')?.children.length>0)",70000));
            assertEquals("true",evaluate(instrumentation,view,
                "(()=>{const s=document.createElement('script');" +
                "s.src='/assets/web/qa-subtitles.js';document.head.appendChild(s);return true})()"));
            assertTrue("Enhanced subtitle adapter did not become ready",
                waitFor(instrumentation,view,
                    "window.__enhancedSubtitleQa?.ready===true || " +
                    "window.__enhancedSubtitleQa?.error===true",30000));
            assertEquals("false",evaluate(instrumentation,view,
                "window.__enhancedSubtitleQa?.error===true"));
            assertEquals("true",evaluate(instrumentation,view,
                "window.__enhancedSubtitleQa?.policyPassed===true"));
            assertEquals("true",evaluate(instrumentation,view,
                "window.__enhancedSubtitleQa?.backend===true && " +
                "window.__enhancedSubtitleQa?.trackListed===true && " +
                "window.__enhancedSubtitleQa?.defaultOff===true"));

            instrumentation.runOnMainSync(view::requestFocus);
            assertEquals("true",evaluate(instrumentation,view,
                "(()=>{let b=document.getElementById('enhanced-subtitles-qa-start');" +
                "b.focus();return document.activeElement===b})()"));
            Thread.sleep(300);
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER);
            boolean started = waitFor(instrumentation,view,
                "window.__enhancedSubtitleQa?.gesture===true",3500);
            if (!started) {
                instrumentation.runOnMainSync(view::requestFocus);
                assertEquals("true",evaluate(instrumentation,view,
                    "(()=>{let b=document.getElementById('enhanced-subtitles-qa-start');" +
                    "b.focus();return document.activeElement===b})()"));
                Thread.sleep(300);
                instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER);
                started = waitFor(instrumentation,view,
                    "window.__enhancedSubtitleQa?.gesture===true",4000);
            }
            assertTrue("Genuine Android remote key was not received",started);
            assertTrue("Decoded video, VTT cue and return to Off unverified",
                waitFor(instrumentation,view,
                    "window.__enhancedSubtitleQa?.complete===true || " +
                    "window.__enhancedSubtitleQa?.error===true",27000));
            assertEquals("true",evaluate(instrumentation,view,
                "window.__enhancedSubtitleQa?.complete===true && " +
                "window.__enhancedSubtitleQa?.decoded===true && " +
                "window.__enhancedSubtitleQa?.trackLoaded===true && " +
                "window.__enhancedSubtitleQa?.cueVisible===true && " +
                "window.__enhancedSubtitleQa?.restoredOff===true && " +
                "window.__enhancedSubtitleQa?.error===false"));
            assertEquals("true",evaluate(instrumentation,view,
                "Boolean(document.getElementById('app')?.children.length>0)"));
        } finally {
            instrumentation.runOnMainSync(activity::finish);
        }
    }
}
