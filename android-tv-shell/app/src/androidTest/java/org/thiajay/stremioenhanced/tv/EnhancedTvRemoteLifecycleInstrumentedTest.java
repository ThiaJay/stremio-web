package org.thiajay.stremioenhanced.tv;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Button;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Disposable Android TV remote acceptance. Original app, anonymous Core,
 * genuine D-pad keys and no account, provider, watched-state or device changes. */
@RunWith(AndroidJUnit4.class)
public final class EnhancedTvRemoteLifecycleInstrumentedTest {
    private static void stage(String marker) {
        Log.i("EnhancedCoreQA", "CORE_QA_STAGE_" + marker);
    }
    private static WebView webView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup parent=(ViewGroup)view;
            for(int i=0;i<parent.getChildCount();i++) {
                WebView found=webView(parent.getChildAt(i));
                if(found!=null)return found;
            }
        }
        return null;
    }
    private static Button nativeButton(View view, String label) {
        if(view instanceof Button) {
            Button button=(Button)view;
            CharSequence description=button.getContentDescription();
            if(description!=null&&label.contentEquals(description))return button;
        }
        if(view instanceof ViewGroup) {
            ViewGroup parent=(ViewGroup)view;
            for(int i=0;i<parent.getChildCount();i++) {
                Button found=nativeButton(parent.getChildAt(i),label);
                if(found!=null)return found;
            }
        }
        return null;
    }
    private static String evaluate(Instrumentation instrument,WebView view,String script)
            throws Exception {
        CountDownLatch done=new CountDownLatch(1);
        AtomicReference<String> value=new AtomicReference<>("");
        instrument.runOnMainSync(()->view.evaluateJavascript(script,result->{
            value.set(result);done.countDown();
        }));
        assertTrue("Remote QA JavaScript callback timed out",done.await(10,TimeUnit.SECONDS));
        return value.get();
    }
    private static boolean waitFor(Instrumentation instrument,WebView view,
                                   String script,int durationMs) throws Exception {
        long end=android.os.SystemClock.elapsedRealtime()+durationMs;
        do {
            if("true".equals(evaluate(instrument,view,script)))return true;
            Thread.sleep(350);
        }while(android.os.SystemClock.elapsedRealtime()<end);
        return false;
    }
    private static boolean finishing(Activity activity,int durationMs)
            throws InterruptedException {
        long end=android.os.SystemClock.elapsedRealtime()+durationMs;
        do {
            if(activity.isFinishing()||activity.isDestroyed())return true;
            Thread.sleep(100);
        }while(android.os.SystemClock.elapsedRealtime()<end);
        return false;
    }
    private static Activity launch(Instrumentation instrument) {
        Intent start=new Intent(instrument.getTargetContext(),EnhancedTvActivity.class);
        start.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return instrument.startActivitySync(start);
    }
    private static WebView mounted(Instrumentation instrument,Activity activity)
            throws Exception {
        AtomicReference<WebView> found=new AtomicReference<>();
        instrument.runOnMainSync(()->found.set(webView(activity.getWindow().getDecorView())));
        assertNotNull("Actual Enhanced TV WebView missing",found.get());
        assertTrue("Original Enhanced React failed to mount",
            waitFor(instrument,found.get(),
                "location.origin==='https://appassets.androidplatform.net'&&"+
                "location.pathname==='/assets/web/index.html'&&"+
                "Boolean(document.getElementById('app')?.children.length>0)",75000));
        return found.get();
    }
    private static void anonymous(Instrumentation instrument,WebView view)
            throws Exception {
        assertTrue("Core state API not ready for anonymous identity check",
            waitFor(instrument,view,"typeof window.core?.getState==='function'",45000));
        assertEquals("true",evaluate(instrument,view,
            "(()=>{window.__nativeQaAnon=false;window.core.getState('ctx')"+
            ".then(s=>{window.__nativeQaAnon=s?.profile?.auth===null})"+
            ".catch(()=>{});return true})()"));
        assertTrue("Fresh emulator Core is not demonstrably anonymous",
            waitFor(instrument,view,"window.__nativeQaAnon===true",12000));
    }
    private static void pressCentre(Instrumentation instrument,Activity activity,int label)
            throws Exception {
        Button button=nativeButton(activity.getWindow().getDecorView(),
                                   activity.getString(label));
        assertNotNull("Native remote toolbar button missing",button);
        assertTrue("Native remote button not accessible",
            button.isEnabled()&&button.isClickable()&&button.isFocusable()&&
            button.getVisibility()==View.VISIBLE);
        instrument.runOnMainSync(button::requestFocus);
        assertTrue("Native TV toolbar button did not take focus",button.isFocused());
        instrument.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER);
    }
    private static void setDocumentMarker(Instrumentation instrument,WebView view)
            throws Exception {
        assertEquals("true",evaluate(instrument,view,
            "(()=>{window.__nativeQaDocumentToken=73;return true})()"));
    }
    private static void verifyFreshDocument(Instrumentation instrument,WebView view)
            throws Exception {
        assertTrue("Genuine remote action did not reload Enhanced React",
            waitFor(instrument,view,
                "location.origin==='https://appassets.androidplatform.net'&&"+
                "location.pathname==='/assets/web/index.html'&&"+
                "Boolean(document.getElementById('app')?.children.length>0)&&"+
                "window.__nativeQaDocumentToken===undefined",75000));
    }

    @Test(timeout=225000)
    public void nativeReloadHomeExitRequireActualRemoteKeys() throws Exception {
        Instrumentation instrument=InstrumentationRegistry.getInstrumentation();
        Activity activity=launch(instrument);
        try {
            WebView view=mounted(instrument,activity);
            stage("REMOTE_REACT_MOUNTED");
            anonymous(instrument,view);
            stage("REMOTE_ANONYMOUS");
            setDocumentMarker(instrument,view);
            pressCentre(instrument,activity,R.string.reload);
            verifyFreshDocument(instrument,view);
            stage("REMOTE_RELOAD_MOUNTED");
            anonymous(instrument,view);
            setDocumentMarker(instrument,view);
            pressCentre(instrument,activity,R.string.go_home);
            verifyFreshDocument(instrument,view);
            stage("REMOTE_HOME_MOUNTED");
            anonymous(instrument,view);
            stage("REMOTE_HOME_ANONYMOUS");
            pressCentre(instrument,activity,R.string.exit);
            assertTrue("Real remote Exit failed to finish isolated Activity",
                       finishing(activity,7000));
            stage("REMOTE_EXIT_CONFIRMED");
        }finally {
            instrument.runOnMainSync(activity::finish);
        }
    }

    @Test(timeout=115000)
    public void nativeBackRemainsWithinSafeHostOrExits() throws Exception {
        Instrumentation instrument=InstrumentationRegistry.getInstrumentation();
        Activity activity=launch(instrument);
        try {
            WebView view=mounted(instrument,activity);
            anonymous(instrument,view);
            stage("BACK_ANONYMOUS");
            boolean hasHistory=view.canGoBack();
            instrument.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);
            if(hasHistory&&!activity.isFinishing()) {
                assertTrue("Remote Back navigated outside local host",
                    waitFor(instrument,view,
                        "location.origin==='https://appassets.androidplatform.net'",
                        12000));
                stage("BACK_SAFE_INTERNAL_NAVIGATION");
            }else {
                assertTrue("Remote Back did not exit isolated TV host",
                    finishing(activity,7000));
                stage("BACK_EXIT_CONFIRMED");
            }
        }finally {
            instrument.runOnMainSync(activity::finish);
        }
    }
}
