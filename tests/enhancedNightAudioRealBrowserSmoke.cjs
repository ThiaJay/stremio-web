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
  if(media.error || media.paused || media.volume!==0.46)throw Error('Media playback or volume altered');
  session.configure({when:'off'});
  if(session.snapshot().status!=='off'||media.paused||media.volume!==0.46)
      throw Error('Off did not restore original media path');
  session.destroy();
  media.pause();
  media.remove();
  output.textContent='HTMLVIDEO_BROWSER_GRAPH_PASS';
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
    const run = cp.spawnSync(chrome, [
        '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
        '--disable-gpu', '--ignore-certificate-errors',
        '--autoplay-policy=no-user-gesture-required',
        '--virtual-time-budget=20000', '--dump-dom', url,
    ], { encoding: 'utf8', timeout: 60000, maxBuffer: 8*1024*1024 });
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    const html = run.stdout || '';
    const passed = run.status === 0 &&
        html.includes('<output id="smoke">HTMLVIDEO_BROWSER_GRAPH_PASS</output>');
    if (!passed) {
        console.error('BROWSER_SMOKE_NOT_ACCEPTED');
        console.error('Chrome status',run.status,'signal',run.signal);
        console.error((run.stderr || '').slice(-2500));
        console.error(html.slice(-3200));
        process.exitCode=1;
    } else {
        console.log('HTMLVIDEO_BROWSER_GRAPH_PASS');
        console.log('Synthetic same-origin media, real Chromium AudioContext and restored bypass verified.');
        console.log('No account, third-party source, speaker output or physical Android audio claimed.');
    }
});
