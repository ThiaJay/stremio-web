'use strict';
// Test-only bundled copy of the exact @stremio/stremio-video player engine.
// No Core, account, addons, production stream or watched-state operations.
const StremioVideo = require('@stremio/stremio-video');
(() => {
    const host = 'https://appassets.androidplatform.net';
    if (location.origin !== host || location.pathname !== '/assets/web/index.html' ||
        window.__enhancedBackendQa) return;
    const state = {ready:false, gesture:false, backend:false, video:false,
        audioActive:false, audioOff:false, error:false};
    Object.defineProperty(window,'__enhancedBackendQa',{value:state});
    const panel = document.createElement('section');
    panel.id='enhanced-real-engine-qa';
    panel.style.cssText='position:fixed;inset:14px auto auto 14px;z-index:2147483647;padding:12px;background:#152a30;color:white';
    const button = document.createElement('button');
    button.id='enhanced-real-engine-start';
    button.textContent='Play original media through Stremio video engine';
    button.disabled=true;
    button.style.cssText='padding:14px;font-size:20px';
    const container=document.createElement('div');
    container.id='enhanced-real-engine-video';
    container.style.cssText='width:320px;height:180px;margin-top:12px';
    panel.append(button,container);
    document.body.appendChild(panel);
    const engine=new StremioVideo();
    let objectURL=null, media=null, frames=0, offRequested=false;
    function changed(name,value) {
        if(name!=='nightAudio'||!value||typeof value!=='object')return;
        if(value.requested===true && value.status==='active')state.audioActive=true;
        if(state.audioActive && value.status==='off')state.audioOff=true;
    }
    engine.on('implementationChanged',manifest=>{
        state.backend=!!manifest && /^HTMLVideo/.test(manifest.name) &&
            Array.isArray(manifest.commands) && manifest.commands.includes('setNightAudio');
        if(state.backend)engine.dispatch({type:'observeProp',propName:'nightAudio'});
    });
    engine.on('propChanged',changed);
    engine.on('propValue',changed);
    engine.on('error',()=>{state.error=true;});
    async function prepare(){
        const res=await fetch('/assets/web/qa-local.mp4',
            {cache:'no-store',redirect:'error',credentials:'omit'});
        if(!res.ok)throw Error('Original local media absent');
        const bytes=await res.arrayBuffer();
        if(bytes.byteLength<15000||bytes.byteLength>4000000)throw Error('Original media size');
        objectURL=URL.createObjectURL(new Blob([bytes],{type:'video/mp4'}));
        if(new URL(objectURL).origin!==host)throw Error('Blob origin');
        engine.dispatch({type:'command',commandName:'load',commandArgs:{
            stream:{url:objectURL},autoplay:false,time:0
        }},{containerElement:container});
        media=container.querySelector('video');
        if(!state.backend||!media)throw Error('Expected actual HTMLVideo adapter');
        if(typeof media.requestVideoFrameCallback!=='function')throw Error('No video callbacks');
        await new Promise((resolve,reject)=>{
            if(media.readyState>=HTMLMediaElement.HAVE_METADATA)return resolve();
            media.addEventListener('loadedmetadata',resolve,{once:true});
            media.addEventListener('error',()=>reject(Error('Actual backend decode error')),{once:true});
            setTimeout(()=>reject(Error('Actual backend metadata timed out')),18000);
        });
        if(media.videoWidth<100||media.videoHeight<60||
            media.duration<3||media.duration>8)throw Error('Decoded video properties');
        button.disabled=false;
        button.focus();
        state.ready=true;
    }
    button.addEventListener('click',()=>{
        if(!state.ready||state.gesture||state.error)return;
        state.gesture=true;
        button.disabled=true;
        const onFrame=(_time,info)=>{
            frames=Math.max(frames,info.presentedFrames||0);
            if(!media.ended)media.requestVideoFrameCallback(onFrame);
        };
        media.requestVideoFrameCallback(onFrame);
        engine.dispatch({type:'setProp',propName:'paused',propValue:false});
        engine.dispatch({type:'command',commandName:'setNightAudio',
            commandArgs:{profile:{when:'always',strength:'balanced'}}});
        const deadline=Date.now()+18000;
        function check(){
            if(media.currentTime>1.4&&frames>=6&&media.videoWidth>=100&&!media.paused)
                state.video=true;
            if(state.video&&state.audioActive&&!offRequested){
                offRequested=true;
                engine.dispatch({type:'command',commandName:'setNightAudio',
                    commandArgs:{profile:{when:'off'}}});
            }
            if(state.video&&state.audioActive&&state.audioOff)return;
            if(Date.now()<deadline&&!state.error)setTimeout(check,120);
            else state.error=true;
        }
        setTimeout(check,180);
    });
    window.addEventListener('pagehide',()=>{
        engine.destroy();
        if(objectURL)URL.revokeObjectURL(objectURL);
    },{once:true});
    prepare().catch(()=>{state.error=true;});
})();
