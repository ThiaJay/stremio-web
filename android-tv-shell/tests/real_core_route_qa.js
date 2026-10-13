'use strict';
// Disposable Android instrumentation only. This exercises the ACTUAL Core
// transport, HashRouter Player route, selected stream and Video component.
// It cannot authenticate or use an addon; it refuses a non-anonymous Core.
(() => {
    const origin='https://appassets.androidplatform.net';
    if(location.origin!==origin||location.pathname!=='/assets/web/index.html'||
       window.__coreRouteQa)return;
    const state={
        ready:false,anonymous:false,gesture:false,route:false,
        coreSelected:false,videoFound:false,decoded:false,
        autoPlayed:false,manualPlay:false,finished:false,problem:'none'
    };
    Object.defineProperty(window,'__coreRouteQa',{value:state});
    const panel=document.createElement('section');
    panel.id='enhanced-core-route-qa';
    panel.style.cssText='position:fixed;top:10px;right:10px;z-index:2147483647;padding:12px;background:#172a32;color:white';
    const button=document.createElement('button');
    button.id='enhanced-core-route-start';
    button.disabled=true;
    button.textContent='Open original media in real Stremio Player route';
    button.style.cssText='padding:12px;font-size:18px';
    panel.appendChild(button);
    document.body.appendChild(panel);
    let objectURL=null,encoded=null,media=null,frames=0;
    let lastCorePoll=0;
    let routeRequestedAt=0;
    const fail=(reason)=>{if(state.problem==='none')state.problem=reason;};


    // Runs only after genuine Core failure. This cannot bypass the Core gate.
    // All requests stay within fixed appassets paths, without account data.
    async function diagnoseCoreBootstrap() {
        const p={
            done:false,workerApi:'unknown',wasmApi:'unknown',
            bundle:'unknown',workerAsset:'unknown',workerLaunch:'unknown',
            wasmAsset:'unknown',wasmMime:'unknown',wasmCompile:'unknown'
        };
        state.coreProbe=p;
        const boundedLocalFetch=async(path)=>{
            const controller=new AbortController();
            const timeout=setTimeout(()=>controller.abort(),10000);
            try {
                return await fetch(path,{
                    cache:'no-store',credentials:'omit',redirect:'error',
                    signal:controller.signal
                });
            } finally { clearTimeout(timeout); }
        };
        try {
            p.workerApi=typeof Worker==='function'?'present':'missing';
            p.wasmApi=typeof WebAssembly!=='undefined' &&
                typeof WebAssembly.compile==='function'?'present':'missing';
            const main=Array.from(document.querySelectorAll('script[src]'))
                .map(node=>{try{return new URL(node.src,location.href);}catch(_){return null;}})
                .find(url=>url&&url.origin===origin&&
                    /^\/assets\/web\/[a-f0-9]{40}\/scripts\/main\.js$/.test(url.pathname));
            if(!main){p.bundle='missing';return;}
            p.bundle='verified';
            const prefix=main.pathname.slice(0,-'scripts/main.js'.length);
            const workerPath=prefix+'scripts/worker.js';
            const wasmPath=prefix+'binaries/stremio_core_web_bg.wasm';
            try {
                const response=await boundedLocalFetch(workerPath);
                p.workerAsset=response.ok?'present':'missing';
            }catch(_){p.workerAsset='missing';}
            if(p.workerApi==='present'&&p.workerAsset==='present'){
                let diagnosticWorker=null;
                try {
                    // No init is sent. Successful construction is NOT Core acceptance.
                    diagnosticWorker=new Worker(workerPath);
                    p.workerLaunch=await new Promise(resolve=>{
                        let settled=false;
                        const finish=value=>{if(!settled){settled=true;resolve(value);}};
                        diagnosticWorker.addEventListener('error',
                            ()=>finish('script-error'),{once:true});
                        setTimeout(()=>finish('no-immediate-error'),1800);
                    });
                }catch(_){p.workerLaunch='constructor-error';}
                finally{if(diagnosticWorker)diagnosticWorker.terminate();}
            }
            let response;
            try {
                response=await boundedLocalFetch(wasmPath);
                p.wasmAsset=response.ok?'present':'missing';
            }catch(_){p.wasmAsset='missing';}
            if(p.wasmAsset!=='present')return;
            p.wasmMime=(response.headers.get('content-type')||'')
                .split(';')[0].trim().toLowerCase()==='application/wasm'?'correct':'other';
            const bytes=await response.arrayBuffer();
            if(bytes.byteLength<100000||bytes.byteLength>10000000){
                p.wasmAsset='invalid-size';return;
            }
            if(p.wasmApi==='present'){
                p.wasmCompile=await Promise.race([
                    WebAssembly.compile(bytes).then(()=>'pass',()=>'fail'),
                    new Promise(resolve=>setTimeout(()=>resolve('timeout'),12500))
                ]);
            }
        }catch(_){p.bundle=p.bundle==='unknown'?'error':p.bundle;}
        finally{p.done=true;}
    }

    function attachMedia(){
        if(media)return true;
        const candidate=Array.from(document.querySelectorAll('video')).find(v=>{
            try {
                const src=v.currentSrc||v.src||'';
                return src===objectURL;
            } catch(_){return false;}
        });
        if(!candidate)return false;
        media=candidate;
        state.videoFound=true;
        media.addEventListener('error',()=>fail('media-decode'),{once:true});
        if(typeof media.requestVideoFrameCallback!=='function'){
            fail('frame-api-unavailable');return false;
        }
        function frame(_time,info){
            frames=Math.max(frames,info.presentedFrames||0);
            if(!media.ended)media.requestVideoFrameCallback(frame);
        }
        media.requestVideoFrameCallback(frame);
        return true;
    }
    function observe(){
        if(state.problem!=='none'||state.finished)return;
        const inRoute=location.hash.startsWith('#/player/');
        if(inRoute)state.route=true;
        if(inRoute && Date.now()-lastCorePoll>1000){
            lastCorePoll=Date.now();
            window.core.getState('player').then(p=>{
                if(p&&p.selected&&p.stream&&p.stream.type==='Ready')state.coreSelected=true;
            }).catch(()=>{});
        }
        attachMedia();
        if(media&&media.currentTime>1.3&&frames>=5&&
           media.videoWidth>=100&&media.videoHeight>=60){
            state.decoded=true;
            state.finished=true;
            // Automatic playback evidence is separate from a later remote
            // key. Never infer this from successful media metadata alone.
            if(!state.manualPlay)state.autoPlayed=true;
            return;
        }
        if(routeRequestedAt && Date.now()-routeRequestedAt>28000 && !state.videoFound)
            fail('player-video-not-found');
        else setTimeout(observe,200);
    }

    state.focusRealPlayControl=()=>{
        if(!state.route||!media||state.decoded)return false;
        const controls=Array.from(document.querySelectorAll('button[title]'));
        const play=controls.find(b=>b.getAttribute('title')==='Play' &&
            !b.classList.contains('disabled'));
        if(!play)return false;
        play.focus();
        return document.activeElement===play;
    };
    state.noteManualGesture=()=>{state.manualPlay=true;};

    async function prepare(){
        const deadline=Date.now()+50000;
        while((!window.core||typeof window.core.getState!=='function')&&
              Date.now()<deadline)await new Promise(r=>setTimeout(r,350));
        const core=window.core;
        if(!core){fail('core-unavailable');void diagnoseCoreBootstrap();return;}
        let ctx;
        try {ctx=await core.getState('ctx');}
        catch(_){fail('core-state-unavailable');return;}
        if(!ctx||!ctx.profile||ctx.profile.auth!==null){
            fail('not-anonymous');return;
        }
        state.anonymous=true;
        const response=await fetch('/assets/web/qa-local.mp4',
            {cache:'no-store',redirect:'error',credentials:'omit'});
        if(!response.ok){fail('original-media-missing');return;}
        const bytes=await response.arrayBuffer();
        if(bytes.byteLength<15000||bytes.byteLength>4000000){
            fail('invalid-local-sample');return;
        }
        objectURL=URL.createObjectURL(new Blob([bytes],{type:'video/mp4'}));
        if(new URL(objectURL).origin!==origin){fail('unsafe-blob-origin');return;}
        try{
            encoded=await core.encodeStream({name:'',description:'',url:objectURL});
            const decoded=await core.decodeStream(encoded);
            if(!decoded||decoded.url!==objectURL||typeof encoded!=='string'||
               encoded.length>8000){fail('core-stream-mismatch');return;}
        }catch(_){fail('core-stream-rejected');return;}
        button.disabled=false;
        button.focus();
        state.ready=true;
    }
    button.addEventListener('click',()=>{
        if(!state.ready||state.gesture||!state.anonymous)return;
        state.gesture=true;
        routeRequestedAt=Date.now();
        // This triggers the real React Player route and its Core Player.Load
        // from the same user gesture. It does NOT dispatch synthetic player
        // state, inject a fake video tag or write an authenticated account.
        location.hash='#/player/'+encodeURIComponent(encoded);
        setTimeout(observe,200);
    });
    window.addEventListener('pagehide',()=>{
        if(objectURL)URL.revokeObjectURL(objectURL);
    },{once:true});
    prepare().catch(()=>fail('qa-prepare-error'));
})();
