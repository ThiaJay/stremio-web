/**
 * Real signed-out Chromium runtime gate for the actual built Enhanced Web.
 * Source-bound Core Worker, React Player, pinned Video and locally generated
 * H264/AAC. No account, add-on/provider, external browser network or release.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const ROOT=path.resolve('build');
const FIXTURE=path.resolve('android-tv-shell/app/src/debug/assets/web/qa-local.mp4');
const CHROME=[process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser']
    .filter(Boolean).find(cmd=>spawnSync(cmd,['--version'],{timeout:5000}).status===0);
const TYPES={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
    '.css':'text/css; charset=utf-8','.wasm':'application/wasm','.json':'application/json',
    '.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon',
    '.woff2':'font/woff2','.woff':'font/woff'};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function fail(code){throw Error('ENHANCED_R1_'+code)}
if(!fs.statSync(path.join(ROOT,'index.html'),{throwIfNoEntry:false})?.isFile())fail('BUILD_MISSING');
const sample=fs.statSync(FIXTURE,{throwIfNoEntry:false});
if(!sample||sample.size<15000||sample.size>4000000)fail('ORIGINAL_SAMPLE_MISSING');
if(!CHROME)fail('CHROMIUM_NOT_AVAILABLE');

let origin='',server,child,ws,profile,blockedExternal=0,sequence=0;
const pending=new Map();
const localServer=http.createServer((req,res)=>{
    let pathname;
    try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname)}
    catch{res.writeHead(400).end();return}
    if(pathname==='/'||pathname==='/index.html')pathname='/index.html';
    if(pathname==='/qa-original.mp4'){
        res.writeHead(200,{'Content-Type':'video/mp4','Cache-Control':'no-store'});
        fs.createReadStream(FIXTURE).pipe(res);
        return;
    }
    if(pathname.includes('\\')||pathname.split('/').includes('..')){res.writeHead(400).end();return}
    const target=path.resolve(ROOT,'.'+pathname);
    if(!target.startsWith(ROOT+path.sep)){res.writeHead(403).end();return}
    if(!fs.statSync(target,{throwIfNoEntry:false})?.isFile()){res.writeHead(404).end();return}
    res.setHeader('Content-Type',TYPES[path.extname(target)]||'application/octet-stream');
    res.setHeader('Cache-Control','no-store');
    fs.createReadStream(target).pipe(res);
});
function call(method,params={},deadline=12000){
    if(!ws||ws.readyState!==WebSocket.OPEN)return Promise.reject(Error('CDP_NOT_READY'));
    return new Promise((resolve,reject)=>{
        const id=++sequence;
        const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT'))},deadline);
        pending.set(id,msg=>{clearTimeout(timer);
            if(msg.error)reject(Error('CDP_COMMAND_FAILED'));
            else resolve(msg.result||{});
        });
        ws.send(JSON.stringify({id,method,params}));
    });
}
async function evaluate(fn){
    const out=await call('Runtime.evaluate',{
        expression:'('+fn.toString()+')()',awaitPromise:true,returnByValue:true
    },16000);
    if(!out.result||out.exceptionDetails)fail('BROWSER_EVALUATION_FAILED');
    return out.result.value;
}
async function waitFor(fn,ms,reason){
    const limit=Date.now()+ms;
    while(Date.now()<limit){if(await fn())return true;await pause(320)}
    fail(reason);
}
async function click(coords){
    if(!Array.isArray(coords)||coords.length!==2)fail('CLICK_TARGET_MISSING');
    const [x,y]=coords;
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1280||y<0||y>800)
        fail('CLICK_OUTSIDE_VISIBLE_PAGE');
    await call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
    await call('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
    await call('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
}
async function main(){
    server=localServer;
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
    const bind=server.address();assert.ok(bind&&typeof bind==='object');
    origin='http://127.0.0.1:'+bind.port;
    profile=fs.mkdtempSync(path.join(os.tmpdir(),'enhanced-r1-private-'));
    child=spawn(CHROME,[
        '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
        '--disable-background-networking','--disable-extensions','--disable-sync',
        '--no-first-run','--no-default-browser-check','--password-store=basic',
        '--remote-debugging-port=0','--window-size=1280,800',
        '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE localhost',
        '--user-data-dir='+profile,'about:blank'
    ],{stdio:'ignore'});
    child.on('error',()=>{});
    const port=await waitFor(()=>{
        try {const p=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);
            return Number.isInteger(p)&&p>0?p:false}
        catch{return false}
    },18000,'CHROMIUM_START_TIMEOUT').then(()=>Number(
        fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]));
    const targets=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
    const target=targets.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
    if(!target)fail('CDP_PAGE_NOT_FOUND');
    ws=new WebSocket(target.webSocketDebuggerUrl);
    await Promise.race([
        new Promise((resolve,reject)=>{
            ws.addEventListener('open',resolve,{once:true});
            ws.addEventListener('error',()=>reject(Error('CDP_CONNECT_FAILED')),{once:true});
        }),
        pause(10000).then(()=>{throw Error('CDP_CONNECT_TIMEOUT')})
    ]);
    ws.addEventListener('message',event=>{
        let msg;try{msg=JSON.parse(event.data)}catch{return}
        if(msg.id&&pending.has(msg.id)){
            const fn=pending.get(msg.id);pending.delete(msg.id);fn(msg);return;
        }
        if(msg.method==='Fetch.requestPaused'){
            const requestId=msg.params?.requestId;
            const url=msg.params?.request?.url||'';
            const safe=url===origin||url.startsWith(origin+'/')||
                url.startsWith('blob:'+origin+'/')||url.startsWith('data:');
            if(!safe)blockedExternal++;
            call(safe?'Fetch.continueRequest':'Fetch.failRequest',
                safe?{requestId}:{requestId,errorReason:'BlockedByClient'}).catch(()=>{});
        }
    });
    await call('Page.enable');
    await call('Runtime.enable');
    await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
    await call('Page.navigate',{url:origin+'/'});
    await waitFor(()=>evaluate(async function(){
        if(!document.querySelector('#app > *')||!window.core)return false;
        try {const ctx=await window.core.getState('ctx');return ctx?.profile?.auth===null}
        catch{return false}
    }),45000,'ANONYMOUS_CORE_WORKER_NOT_READY');
    const prepared=await evaluate(async function(){
        const res=await fetch('/qa-original.mp4',{credentials:'omit',redirect:'error'});
        if(!res.ok)return false;
        const bytes=await res.arrayBuffer();
        if(bytes.byteLength<15000||bytes.byteLength>4000000)return false;
        const objectURL=URL.createObjectURL(new Blob([bytes],{type:'video/mp4'}));
        if(new URL(objectURL).origin!==location.origin)return false;
        const encoded=await window.core.encodeStream({name:'',description:'',url:objectURL});
        const decoded=await window.core.decodeStream(encoded);
        if(!decoded||decoded.url!==objectURL||typeof encoded!=='string'||encoded.length>8000)return false;
        const state={objectURL,encoded,trusted:false,video:false,frames:0,decoded:false,error:false};
        Object.defineProperty(window,'__enhancedR1',{value:state});
        const button=document.createElement('button');
        button.id='enhanced-r1-qa-start';
        button.textContent='Play original media';
        button.style.cssText='position:fixed;top:12px;left:12px;z-index:2147483647;padding:18px;background:#234;color:white';
        button.addEventListener('click',e=>{
            if(!e.isTrusted||state.trusted)return;
            state.trusted=true;
            location.hash='#/player/'+encodeURIComponent(encoded);
        });
        document.body.appendChild(button);
        return true;
    });
    if(!prepared)fail('ORIGINAL_CORE_STREAM_ROUNDTRIP');
    const start=await evaluate(function(){
        const r=document.getElementById('enhanced-r1-qa-start').getBoundingClientRect();
        return [r.left+r.width/2,r.top+r.height/2];
    });
    await click(start);
    await waitFor(()=>evaluate(function(){
        return Boolean(window.__enhancedR1?.trusted&&location.hash.startsWith('#/player/'));
    }),6500,'GENUINE_BROWSER_GESTURE_NOT_RECEIVED');
    await waitFor(()=>evaluate(async function(){
        const state=await window.core.getState('player');
        return Boolean(state?.selected&&state.stream?.type==='Ready'&&document.querySelector('#app > *'));
    }),35000,'CORE_PLAYER_STATE_NOT_SELECTED');
    await waitFor(()=>evaluate(function(){
        const s=window.__enhancedR1;
        const video=Array.from(document.querySelectorAll('video'))
            .find(v=>(v.currentSrc||v.src||'')===s.objectURL);
        if(!video)return false;
        if(!s.video){
            s.video=true;
            video.addEventListener('error',()=>{s.error=true},{once:true});
            if(typeof video.requestVideoFrameCallback!=='function'){s.error=true;return false}
            const frame=(_time,info)=>{
                s.frames=Math.max(s.frames,info.presentedFrames||0);
                if(!video.ended)video.requestVideoFrameCallback(frame);
            };
            video.requestVideoFrameCallback(frame);
        }
        return true;
    }),20000,'REAL_PLAYER_VIDEO_ELEMENT_NOT_FOUND');
    async function isDecoded(){return evaluate(function(){
        const s=window.__enhancedR1;
        const video=Array.from(document.querySelectorAll('video'))
            .find(v=>(v.currentSrc||v.src||'')===s.objectURL);
        if(!video||s.error)return false;
        if(video.currentTime>1.3&&s.frames>=5&&video.videoWidth>=100&&video.videoHeight>=60)
            s.decoded=true;
        return s.decoded;
    })}
    let decoded=false;
    const until=Date.now()+11000;
    while(Date.now()<until){if(await isDecoded()){decoded=true;break}await pause(350)}
    if(!decoded){
        const playButton=await evaluate(function(){
            const b=Array.from(document.querySelectorAll('button')).find(x=>
                (x.title==='Play'||x.getAttribute('aria-label')==='Play')&&!x.disabled);
            if(!b)return null;
            const r=b.getBoundingClientRect();
            return r.width>5&&r.height>5?[r.left+r.width/2,r.top+r.height/2]:null;
        });
        if(!playButton)fail('NORMAL_STREMIO_PLAY_CONTROL_NOT_AVAILABLE');
        await click(playButton); // Actual browser input, no direct media playback commands.
        await waitFor(isDecoded,15000,'NORMAL_PLAY_GESTURE_NOT_DECODING');
        decoded=true;
    }
    const ctxAnonymous=await evaluate(async function(){
        const ctx=await window.core.getState('ctx');
        return ctx?.profile?.auth===null;
    });
    if(!decoded||!ctxAnonymous)fail('FINAL_ANONYMOUS_STATE_UNVERIFIED');
    console.log('ENHANCED_R1_ANONYMOUS_CHROMIUM_CORE_PLAYER_ORIGINAL_MEDIA_PASS');
    console.log(JSON.stringify({result:'REAL_BROWSER_ANONYMOUS_ORIGINAL_MEDIA_ACCEPTED',
        chromium:true,coreWorker:true,reactPlayer:true,trustedInput:true,
        decodedFrames:true,externalRequestsBlocked:blockedExternal,
        accountTested:false,addonTested:false,physicalTvTested:false,releaseEligible:false}));
}
let result='failed';
try{await main();result='success'}
catch(e){const label=String(e?.message||'UNKNOWN').replace(/[^A-Z0-9_]/g,'_').slice(0,70);
    console.error('ENHANCED_R1_ACCEPTANCE_FAIL_'+label);process.exitCode=1;
}finally{
    try{ws?.close()}catch{}
    if(child&&!child.killed)child.kill('SIGTERM');
    await pause(500);
    if(child&&child.exitCode===null)child.kill('SIGKILL');
    try{server?.closeAllConnections()}catch{}
    if(server)await new Promise(resolve=>server.close(resolve));
    if(profile){try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100})}catch{}}
    if(result!=='success')console.error('ENHANCED_R1_NOT_ACCEPTED');
}
