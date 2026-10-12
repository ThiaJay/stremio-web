'use strict';

// Actual, anonymous Chromium MediaElementAudioSource smoke using an original,
// generated local PCM tone. It does not inspect user media, providers or login.
const fs = require('node:fs');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const VIDEO = '@stremio/stremio-video/src/audio/';
const policySource = fs.readFileSync(require.resolve(VIDEO + 'nightAudioPolicy'), 'utf8');
const sessionSource = fs.readFileSync(require.resolve(VIDEO + 'HtmlNightAudioSession'), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'night-audio-browser-'));
const cert = path.join(tmp, 'cert.pem');
const key = path.join(tmp, 'key.pem');

const openssl = cp.spawnSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', key, '-out', cert,
    '-subj', '/CN=localhost', '-days', '1',
], { stdio: 'ignore' });
if (openssl.status !== 0) throw new Error('Temporary test-only HTTPS certificate unavailable');

const page = String.raw`<!doctype html><html><head><meta charset="utf-8"><title>Local synthetic audio smoke</title></head>
<body><output id="smoke"></output>
<script src="/policy.js"></script><script src="/session.js"></script>
<script>
'use strict';
const output = document.getElementById('smoke');
function buildOriginalPcmWav() {
    const sampleRate=16000, frames=sampleRate*3;
    const bytes=new ArrayBuffer(44+frames*2);
    const view=new DataView(bytes);
    function label(offset,s){ for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));}
    label(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);
    label(8,'WAVE');label(12,'fmt ');view.setUint32(16,16,true);
    view.setUint16(20,1,true);view.setUint16(22,1,true);
    view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);
    view.setUint16(32,2,true);view.setUint16(34,16,true);
    label(36,'data');view.setUint32(40,frames*2,true);
    for(let i=0;i<frames;i++){
        const amplitude=(i%32000<16000?0.7:0.28);
        view.setInt16(44+i*2,Math.floor(Math.sin(2*Math.PI*440*i/sampleRate)*amplitude*32767),true);
    }
    return new Blob([bytes],{type:'audio/wav'});
}
(async()=>{
  const media=document.createElement('video');
  media.preload='auto';media.loop=true;media.volume=0.46;
  media.src=URL.createObjectURL(buildOriginalPcmWav());
  document.body.appendChild(media);
  await media.play();
  if(media.error || media.paused || !media.currentSrc.startsWith('blob:'))throw Error('Synthetic media cannot play');
  const session=new window.__NightAudioSession.HtmlNightAudioSession({
      videoElement:media,origin:location.origin,changed:()=>{}
  });
  session.begin();
  session.configure({when:'always',strength:'strong'});
  let active=false;
  for(let attempt=0;attempt<50;attempt++){
      if(session.snapshot().status==='active'){active=true;break;}
      await new Promise(resolve=>setTimeout(resolve,150));
  }
  if(!active)throw Error('Real Chromium Web Audio graph did not become active: '+session.snapshot().status);
  if(!session.hasCapturedMediaElement())
    throw Error('Source-switch safety marker not set when real audio graph captured media');
  if(media.error || media.paused || media.volume!==0.46)throw Error('Media playback or volume altered');
  // Independently render actual Chrome Web Audio PCM with exactly the policy
  // compressor parameters. This checks dynamic range reduction without
  // claiming that a physical speaker or addon media was ever exercised.
  async function renderLocalPcm(compress){
    const rate=16000,frames=rate*2,ctx=new OfflineAudioContext(1,frames,rate);
    const pcm=ctx.createBuffer(1,frames,rate);
    const data=pcm.getChannelData(0);
    for(let i=0;i<frames;i++){
      const amplitude=i<rate?0.06:0.65;
      data[i]=Math.sin(2*Math.PI*440*i/rate)*amplitude;
    }
    const source=ctx.createBufferSource();source.buffer=pcm;
    if(compress){
      const p=window.__NightAudioPolicy.PRESETS.strong;
      const cmp=ctx.createDynamicsCompressor();
      cmp.threshold.value=20*Math.log10(p.threshold);
      cmp.knee.value=8;cmp.ratio.value=p.ratio;
      cmp.attack.value=p.attackMs/1000;cmp.release.value=p.releaseMs/1000;
      const trim=ctx.createGain();trim.gain.value=0.9;
      source.connect(cmp);cmp.connect(trim);trim.connect(ctx.destination);
    }else source.connect(ctx.destination);
    source.start(0);
    const result=await ctx.startRendering(),samples=result.getChannelData(0);
    function rms(from,to){
      let sum=0,count=0;
      for(let i=from;i<to;i++){sum+=samples[i]*samples[i];count++;}
      return Math.sqrt(sum/count);
    }
    return {low:rms(rate*0.3,rate*0.9),high:rms(rate*1.3,rate*1.9)};
  }
  const original=await renderLocalPcm(false);
  const processed=await renderLocalPcm(true);
  const originalContrast=original.high/original.low;
  const processedContrast=processed.high/processed.low;
  if(!Number.isFinite(processedContrast)||
      !(processedContrast<originalContrast*0.80)||
      !(processedContrast>1.15)||
      !(processed.high<original.high*0.80))
    throw Error('Chromium compressor did not reduce synthetic PCM dynamic range');
  session.configure({when:'off'});
  if(session.snapshot().status!=='off'||media.paused||media.volume!==0.46)
      throw Error('Off did not restore original media path');
  if(!session.hasCapturedMediaElement())
      throw Error('Off incorrectly forgot irreversible audio capture');
  session.destroy();
  media.pause();
  media.remove();
  output.textContent='HTMLVIDEO_BROWSER_GRAPH_AND_COMPRESSOR_PASS';
})().catch(error=>{
  output.textContent='HTMLVIDEO_BROWSER_GRAPH_FAIL';
  console.error('Synthetic browser smoke failed',error.message);
});
</script></body></html>`;

const scripts = {
    '/policy.js': '(function(){const module={exports:{}};\n' +
        policySource + '\nwindow.__NightAudioPolicy=module.exports;})();',
    '/session.js': '(function(){const module={exports:{}};' +
        'const require=(p)=>{if(p!==\'./nightAudioPolicy\')throw Error(\'Unexpected import\');return window.__NightAudioPolicy;};\n' +
        sessionSource + '\nwindow.__NightAudioSession=module.exports;})();',
};

const server = https.createServer({
    key: fs.readFileSync(key), cert: fs.readFileSync(cert),
}, (req, res) => {
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page);
    } else if (Object.prototype.hasOwnProperty.call(scripts, req.url)) {
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end(scripts[req.url]);
    } else {
        res.writeHead(404).end('Not found');
    }
});

const chrome = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
    .find(name => cp.spawnSync('which', [name], { stdio: 'ignore' }).status === 0);
if (!chrome) throw new Error('Real headless Chromium executable not available');

server.listen(0, '127.0.0.1', () => {
    const url = 'https://127.0.0.1:' + server.address().port + '/';
    // Keep this Node HTTPS server responsive whilst the real browser loads.
    const run = cp.spawn(chrome, [
        '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
        '--disable-gpu', '--ignore-certificate-errors',
        '--autoplay-policy=no-user-gesture-required',
        '--virtual-time-budget=20000', '--dump-dom', url,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let html = '';
    let errorText = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; run.kill('SIGTERM'); }, 60000);
    run.stdout.setEncoding('utf8');
    run.stderr.setEncoding('utf8');
    run.stdout.on('data', chunk => { if (html.length < 8*1024*1024) html += chunk; });
    run.stderr.on('data', chunk => { if (errorText.length < 100000) errorText += chunk; });
    run.on('error', error => { errorText += '\n'+String(error); });
    run.on('close', (code, signal) => {
        clearTimeout(timer);
        server.close();
        fs.rmSync(tmp, { recursive: true, force: true });
        const passed = !timedOut && code === 0 &&
            html.includes('<output id="smoke">HTMLVIDEO_BROWSER_GRAPH_AND_COMPRESSOR_PASS</output>');
        if (!passed) {
            console.error('BROWSER_SMOKE_NOT_ACCEPTED');
            console.error('Chrome status',code,'signal',signal,'timedOut',timedOut);
            console.error(errorText.slice(-2500));
            console.error(html.slice(-3200));
            process.exitCode = 1;
        } else {
            console.log('HTMLVIDEO_BROWSER_GRAPH_AND_COMPRESSOR_PASS');
            console.log('Synthetic local media graph, PCM dynamic range compression and bypass verified.');
            console.log('No account, third-party source, speaker output or physical Android audio claimed.');
        }
    });
});
