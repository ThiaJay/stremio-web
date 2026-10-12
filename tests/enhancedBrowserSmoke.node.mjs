/**
 * Unauthenticated Stremio Enhanced browser shell acceptance on a disposable
 * loopback origin. External host DNS is blocked in Chromium. This does not
 * simulate video decoding, Stremio accounts, addons or physical TV controls.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';

const build=path.resolve('build');
assert.ok(fs.existsSync(path.join(build,'index.html')),'Production HTML must exist');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
const requests=[];
const server=http.createServer((req,res)=>{
    let name;
    try {name=decodeURIComponent(new URL(req.url||'/', 'http://127.0.0.1').pathname);} catch {res.writeHead(400).end();return;}
    if(name.includes('\\') || name.split('/').includes('..')) {res.writeHead(400).end();return;}
    const target=path.resolve(build,'.'+name);
    if(!target.startsWith(build+path.sep) && target!==build){res.writeHead(403).end();return;}
    let file=target;
    if(!fs.existsSync(file) || !fs.statSync(file).isFile()){
        if(name==='/' || !path.extname(name))file=path.join(build,'index.html');
        else {res.writeHead(404).end();return;}
    }
    requests.push(name);
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    res.setHeader('Cache-Control','no-store');
    // Only this ephemeral test server injects diagnostics; bundled sources stay unchanged.
    if (path.extname(file)==='.html') {
        const hook=`<script>(function(){function record(e){var msg=String(e&&e.message||e&&e.reason&&e.reason.message||'unknown error');document.documentElement.setAttribute('data-qa-runtime-error',msg.slice(0,180));}window.addEventListener('error',record);window.addEventListener('unhandledrejection',record);})();<`+'/script>';
        const html=fs.readFileSync(file,'utf8');
        return void res.end(html.replace('<head>','<head>'+hook));
    }
    fs.createReadStream(file).pipe(res);
});
const chromeCandidates=[process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean);
let chrome=null;
for(const candidate of chromeCandidates){const chk=spawnSync(candidate,['--version'],{timeout:5000,encoding:'utf8'});if(chk.status===0){chrome=candidate;break}}
assert.ok(chrome,'CHROMIUM_NOT_AVAILABLE_FOR_RUNTIME_SMOKE');
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const address=server.address();assert.ok(address && typeof address==='object');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'enhanced-chrome-isolated-'));
const url=`http://127.0.0.1:${address.port}/`;
let output='',error='',killed=false;
try{
    const args=[
        '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
        '--disable-background-networking','--disable-extensions','--no-first-run',
        '--disable-sync','--no-default-browser-check','--password-store=basic',
        `--user-data-dir=${profile}`,'--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE localhost',
        '--virtual-time-budget=9000','--dump-dom',url
    ];
    const proc=spawn(chrome,args,{stdio:['ignore','pipe','pipe'],env:{...process.env,CHROME_LOG_FILE:'/dev/null'}});
    proc.stdout.on('data',d=>{if(output.length<500000)output+=d.toString('utf8')});
    proc.stderr.on('data',d=>{if(error.length<12000)error+=d.toString('utf8')});
    const timer=setTimeout(()=>{killed=true;proc.kill('SIGKILL')},30000);
    const exit=await new Promise((resolve,reject)=>{proc.once('error',reject);proc.once('close',resolve)});
    clearTimeout(timer);
    assert.equal(killed,false,'Chromium timed out');
    assert.equal(exit,0,'Chromium failed to render local Web shell: '+error.slice(-500));
    assert.match(output,/<div\s+id="app"[^>]*>\s*</i,'HTML must contain the Stremio application mount');
    const root=output.match(/<div\s+id="app"[^>]*>([\s\S]{0,8000})/i)?.[1]||'';
    const scripts=requests.filter(x=>/\/scripts\/(?:main|worker)\.js$/.test(x));
    const runtimeError=(output.match(/data-qa-runtime-error="([^"]{0,200})"/)||[])[1]||null;
    if (!/^\s*<(?:div|main|section|header|nav|aside|span|img|button)/i.test(root)) {
        console.error(JSON.stringify({result:'BROWSER_ROOT_NOT_MOUNTED',scriptAssetsFetched:scripts.length,staticRequestCount:requests.length,runtimeError:runtimeError&&runtimeError.replace(/https?:\/\/[^\s<>]+/g,'[origin]').replace(/\/home\/[^\s<>]+/g,'[local path]').slice(0,150)}));
    }
    assert.match(root,/^\s*<(?:div|main|section|header|nav|aside|span|img|button)/i,'Client React tree must mount in the app root');
    assert.ok(requests.some(x=>/\/scripts\/main\.js$/.test(x)),'Browser must actually request compiled app JS');
    console.log(JSON.stringify({result:'BROWSER_SHELL_RENDERED_ANONYMOUSLY',chrome,jsAssetRequested:true,reactTreeMounted:true,externalDNSBlocked:true,accountLoginTested:false,mediaPlaybackTested:false,sourceRequests:requests.length}));
} finally {
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(profile,{recursive:true,force:true});
}
