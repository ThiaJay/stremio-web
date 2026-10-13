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
 * Disposable anonymous Core + real Player route + real StremioVideo decoding.
 * Locally generated debug media only. No account, addon or personal device.
 * Unlike standalone backend QA, this exercises Core encode/decode, Player.Load,
 * the React Player and its actual HTMLVideo output.
 */
@RunWith(AndroidJUnit4.class)
public final class EnhancedCoreRouteInstrumentedTest {
    // Fixed anonymous test checkpoints. No URLs, accounts, video or UI data.
    private static void stage(String code) {
        Log.i("EnhancedCoreQA", "CORE_QA_STAGE_" + code);
    }
    private static WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup parent=(ViewGroup)view;
            for(int i=0;i<parent.getChildCount();i++){
                WebView found=findWebView(parent.getChildAt(i));
                if(found!=null)return found;
            }
        }
        return null;
    }

    private static String evaluate(Instrumentation instrument,WebView view,String expression)
            throws Exception {
        CountDownLatch done=new CountDownLatch(1);
        AtomicReference<String> result=new AtomicReference<>("");
        instrument.runOnMainSync(()->view.evaluateJavascript(expression,value->{
            result.set(value);
            done.countDown();
        }));
        assertTrue("Core route JavaScript callback timed out",
            done.await(10,TimeUnit.SECONDS));
        return result.get();
    }

    private static boolean waitFor(Instrumentation instrument,WebView view,
                                   String expression,int maxMs) throws Exception {
        long deadline=android.os.SystemClock.elapsedRealtime()+maxMs;
        do {
            if("true".equals(evaluate(instrument,view,expression)))return true;
            Thread.sleep(350);
        } while(android.os.SystemClock.elapsedRealtime()<deadline);
        return false;
    }

    private static String problem(Instrumentation instrument,WebView view) throws Exception {
        // This is one of the fixed non-sensitive codes in the QA script.
        return evaluate(instrument,view,"window.__coreRouteQa?.problem||'script-not-started'");
    }

    // Privacy-safe fixed reasons only. Never log raw JavaScript, URLs, auth
    // values, cookies, worker data or exception strings from the WebView.
    private static void reportPreflightReason(String code) {
        switch (code) {
            case "\"core-unavailable\"": stage("PREFLIGHT_CORE_UNAVAILABLE"); break;
            case "\"core-state-unavailable\"": stage("PREFLIGHT_CORE_STATE_UNAVAILABLE"); break;
            case "\"not-anonymous\"": stage("PREFLIGHT_NOT_ANONYMOUS"); break;
            case "\"original-media-missing\"": stage("PREFLIGHT_MEDIA_MISSING"); break;
            case "\"invalid-local-sample\"": stage("PREFLIGHT_MEDIA_INVALID"); break;
            case "\"unsafe-blob-origin\"": stage("PREFLIGHT_BLOB_ORIGIN"); break;
            case "\"core-stream-mismatch\"": stage("PREFLIGHT_CORE_STREAM_MISMATCH"); break;
            case "\"core-stream-rejected\"": stage("PREFLIGHT_CORE_STREAM_REJECTED"); break;
            case "\"qa-prepare-error\"": stage("PREFLIGHT_QA_PREPARE_ERROR"); break;
            case "\"player-video-not-found\"": stage("PREFLIGHT_PLAYER_VIDEO_MISSING"); break;
            case "\"media-decode\"": stage("PREFLIGHT_MEDIA_DECODE"); break;
            case "\"frame-api-unavailable\"": stage("PREFLIGHT_FRAME_API_UNAVAILABLE"); break;
            default: stage("PREFLIGHT_UNRECOGNISED"); break;
        }
    }

    @Test(timeout=175000)
    public void fullAnonymousCorePlayerRouteAcceptsOriginalMedia() throws Exception {
        Instrumentation instrument=InstrumentationRegistry.getInstrumentation();
        Intent launch=new Intent(instrument.getTargetContext(),EnhancedTvActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Activity activity=instrument.startActivitySync(launch);
        try {
            AtomicReference<WebView> target=new AtomicReference<>();
            instrument.runOnMainSync(()->target.set(
                findWebView(activity.getWindow().getDecorView())));
            WebView view=target.get();
            assertNotNull("Real Enhanced Android TV WebView absent",view);
            stage("WEBVIEW_PRESENT");
            assertTrue("Original Enhanced React application not mounted",
                waitFor(instrument,view,
                    "location.origin==='https://appassets.androidplatform.net' && " +
                    "location.pathname==='/assets/web/index.html' && " +
                    "Boolean(document.getElementById('app')?.children.length>0)",70000));
            stage("ENHANCED_REACT_MOUNTED");

            assertEquals("true",evaluate(instrument,view,
                "(()=>{const e=document.createElement('script');" +
                "e.src='/assets/web/qa-core-route.js';document.head.appendChild(e);return true})()"));
            stage("QA_SCRIPT_REQUESTED");
            assertTrue("Anonymous Core cannot encode a local stream. State "+problem(instrument,view),
                waitFor(instrument,view,
                    "window.__coreRouteQa?.ready===true || " +
                    "(window.__coreRouteQa?.problem!==undefined && " +
                    "window.__coreRouteQa?.problem!=='none')",58000));
            String preflight=problem(instrument,view);
            if (!"\"none\"".equals(preflight)) reportPreflightReason(preflight);
            assertEquals("Core route preflight failed","\"none\"",preflight);
            assertEquals("true",evaluate(instrument,view,
                "window.__coreRouteQa?.anonymous===true"));
            stage("CORE_ANONYMOUS_ENCODED");

            // Native focus can move from WebView to the four TV toolbar buttons
            // after Core boot. Re-establish both Android and DOM focus before
            // checking focus and delivering genuine remote keys.
            // Never call button.click() or bypass the real key gesture.
            instrument.runOnMainSync(view::requestFocus);
            assertEquals("QA start control lost focus to the Android toolbar",
                "true",evaluate(instrument,view,
                    "(()=>{let b=document.getElementById('enhanced-core-route-start');" +
                    "b.focus();return document.activeElement===b})()"));
            stage("QA_BUTTON_FOCUSED");
            Thread.sleep(350);
            instrument.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER);
            boolean started=waitFor(instrument,view,
                "window.__coreRouteQa?.gesture===true",2500);
            if(!started) {
                // One bounded recovery for a transient initial focus shift.
                instrument.runOnMainSync(view::requestFocus);
                assertEquals("QA remote focus unavailable on retry",
                    "true",evaluate(instrument,view,
                        "(()=>{let b=document.getElementById('enhanced-core-route-start');" +
                        "b.focus();return document.activeElement===b})()"));
                Thread.sleep(350);
                instrument.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER);
                started=waitFor(instrument,view,
                    "window.__coreRouteQa?.gesture===true",4000);
            }
            assertTrue("Real D-pad did not initiate Player navigation",started);
            stage("REMOTE_KEY_ACCEPTED");
            assertTrue("React Player hash route never mounted",
                waitFor(instrument,view,"window.__coreRouteQa?.route===true",12000));
            stage("PLAYER_ROUTE_REACHED");
            assertTrue("Actual Core Player model and selected stream not ready",
                waitFor(instrument,view,"window.__coreRouteQa?.coreSelected===true",40000));
            stage("CORE_PLAYER_SELECTED");
            assertTrue("Real Player HTMLVideo never loaded original local stream",
                waitFor(instrument,view,
                    "window.__coreRouteQa?.videoFound===true",30000));
            stage("PLAYER_VIDEO_FOUND");

            // First try the genuine source-selection user gesture without
            // changing WebView media requirements.
            boolean autoPlayed=waitFor(instrument,view,
                "window.__coreRouteQa?.decoded===true",13000);
            if(!autoPlayed) {
                // Only a real focused, user-facing Play control may recover.
                // No evaluateJavascript('video.play()') or autoplay bypass.
                assertEquals("Core route video has an unrecovered error",
                    "\"none\"",problem(instrument,view));
                assertEquals("No accessible normal Play control",
                    "true",evaluate(instrument,view,
                        "window.__coreRouteQa?.focusRealPlayControl()===true"));
                evaluate(instrument,view,
                    "window.__coreRouteQa?.noteManualGesture()");
                instrument.runOnMainSync(view::requestFocus);
                instrument.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER);
                assertTrue("Normal Stremio Play control did not start decoded frames",
                    waitFor(instrument,view,
                        "window.__coreRouteQa?.decoded===true",15000));
            }

            assertEquals("Core route failure","\"none\"",problem(instrument,view));
            stage("VIDEO_FRAME_DECODED");
            assertEquals("true",evaluate(instrument,view,
                "window.__coreRouteQa?.coreSelected===true"));
            assertEquals("true",evaluate(instrument,view,
                "window.__coreRouteQa?.finished===true"));
            assertEquals("true",evaluate(instrument,view,
                "Boolean(document.getElementById('app')?.children.length>0)"));
            stage("CORE_ROUTE_COMPLETE");
        } finally {
            instrument.runOnMainSync(activity::finish);
        }
    }
}
