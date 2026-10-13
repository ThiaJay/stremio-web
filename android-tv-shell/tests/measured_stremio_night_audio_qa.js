'use strict';
// Test-only bundle of the exact pinned StremioVideo implementation.
// This is injected solely into an anonymous disposable Android emulator.
const StremioVideo = require('@stremio/stremio-video');
(() => {
    const host = 'https://appassets.androidplatform.net';
    if (location.origin !== host || location.pathname !== '/assets/web/index.html' ||
            window.__enhancedMeasuredNightQa ||
            !document.getElementById('app')?.children.length) return;

    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    const state = {
        ready: false, gesture: false, backend: false, video: false,
        requested: false, measured: false, off: false, complete: false, error: false,
        sourceCaptured: false, tapsConnected: false, contextRunning: false,
        inputDetected: false, outputDetected: false, attenuationDetected: false
    };
    Object.defineProperty(window, '__enhancedMeasuredNightQa', { value: state });
    if (!AudioCtor) { state.error = true; return; }

    const panel = document.createElement('section');
    panel.id = 'enhanced-measured-night-qa';
    panel.style.cssText = 'position:fixed;inset:12px auto auto 12px;' +
        'z-index:2147483647;padding:12px;background:#173139;color:white';
    const button = document.createElement('button');
    button.id = 'enhanced-measured-night-start';
    button.type = 'button';
    button.disabled = true;
    button.textContent = 'Play original tone through actual Night Audio';
    button.style.cssText = 'padding:14px;font-size:20px';
    const container = document.createElement('div');
    container.id = 'enhanced-measured-night-video';
    container.style.cssText = 'width:320px;height:180px;margin-top:12px';
    panel.append(button, container);
    document.body.appendChild(panel);

    const instrumented = {
        context: null, source: null, compressor: null, before: null, after: null
    };
    let video = null, frames = 0, url = null, offSent = false, goodWindows = 0;
    const actualAudioContext = window.AudioContext;

    // Insert passive unity analysers INLINE, not as another audible output.
    // Real media source -> analyser -> real compressor -> analyser -> real
    // output trim -> destination. All actual DSP nodes remain unmodified.
    class TestObservedContext extends AudioCtor {
        createDynamicsCompressor() {
            const node = super.createDynamicsCompressor();
            this.__measuredCompressor = node;
            return node;
        }
        createMediaElementSource(element) {
            const source = super.createMediaElementSource(element);
            if (element !== video || !container.contains(element)) {
                state.error = true;
                return source;
            }
            instrumented.context = this;
            instrumented.source = source;
            state.sourceCaptured = true;
            instrumented.compressor = this.__measuredCompressor;
            if (!instrumented.compressor) { state.error = true; return source; }

            const realSourceConnect = source.connect.bind(source);
            source.connect = function(destination, ...args) {
                if (destination === instrumented.compressor && !instrumented.before) {
                    const tap = instrumented.context.createAnalyser();
                    tap.fftSize = 1024;
                    instrumented.before = tap;
                    realSourceConnect(tap);
                    tap.connect(destination);
                    return destination;
                }
                return realSourceConnect(destination, ...args);
            };
            const compressor = instrumented.compressor;
            const realCompressorConnect = compressor.connect.bind(compressor);
            compressor.connect = function(destination, ...args) {
                if (!instrumented.after && destination &&
                        destination.gain && typeof destination.gain.value === 'number') {
                    const tap = instrumented.context.createAnalyser();
                    tap.fftSize = 1024;
                    instrumented.after = tap;
                    realCompressorConnect(tap);
                    tap.connect(destination);
                    return destination;
                }
                return realCompressorConnect(destination, ...args);
            };
            // Do not leave a global constructor override in the Enhanced app.
            window.AudioContext = actualAudioContext;
            return source;
        }
    }
    window.AudioContext = TestObservedContext;

    const engine = new StremioVideo();
    engine.on('implementationChanged', manifest => {
        state.backend = !!manifest && /^HTMLVideo/.test(manifest.name) &&
            Array.isArray(manifest.commands) && manifest.commands.includes('setNightAudio');
        if (state.backend) engine.dispatch({type:'observeProp',propName:'nightAudio'});
    });
    function observe(name, snapshot) {
        if (name !== 'nightAudio' || !snapshot || typeof snapshot !== 'object') return;
        if (snapshot.requested === true && snapshot.status === 'active' &&
                snapshot.audioPath === 'pcm') state.requested = true;
        if (state.requested && snapshot.status === 'off') state.off = true;
    }
    engine.on('propChanged', observe);
    engine.on('propValue', observe);
    engine.on('error', () => { state.error = true; });

    const rms = array => {
        let power = 0;
        for (let i = 0; i < array.length; i++) power += array[i] * array[i];
        return Math.sqrt(power / array.length);
    };

    async function prepare() {
        const response = await fetch('/assets/web/qa-night-loud.mp4',
            {credentials:'omit', redirect:'error', cache:'no-store'});
        if (!response.ok) throw Error('Unavailable original loud fixture');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength < 15000 || bytes.byteLength > 4000000)
            throw Error('Invalid original fixture size');
        url = URL.createObjectURL(new Blob([bytes], {type:'video/mp4'}));
        if (new URL(url).origin !== host) throw Error('Original blob origin mismatch');
        engine.dispatch({type:'command',commandName:'load',commandArgs:{
            stream:{url}, autoplay:false, time:0
        }},{containerElement:container});
        video = container.querySelector('video');
        if (!state.backend || !video) throw Error('Real HTMLVideo backend unavailable');
        if (typeof video.requestVideoFrameCallback !== 'function')
            throw Error('No actual frame callback');
        await new Promise((resolve, reject) => {
            if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return resolve();
            video.addEventListener('loadedmetadata', resolve, {once:true});
            video.addEventListener('error', () => reject(Error('Decode failure')), {once:true});
            setTimeout(() => reject(Error('Metadata timeout')), 18000);
        });
        if (video.videoWidth < 100 || video.videoHeight < 60 ||
                video.duration < 3 || video.duration > 8)
            throw Error('Invalid original media metadata');
        state.ready = true;
        button.disabled = false;
        button.focus();
    }

    button.addEventListener('click', event => {
        if (!event.isTrusted || !state.ready || state.gesture || state.error) {
            state.error = true;
            return;
        }
        state.gesture = true;
        button.disabled = true;
        const onFrame = (_now, info) => {
            frames = Math.max(frames, info.presentedFrames || 0);
            if (!video.ended && !state.complete) video.requestVideoFrameCallback(onFrame);
        };
        video.requestVideoFrameCallback(onFrame);
        engine.dispatch({type:'setProp',propName:'paused',propValue:false});
        engine.dispatch({type:'command',commandName:'setNightAudio',
            commandArgs:{profile:{when:'always', strength:'balanced'}}});
        const input = new Float32Array(1024);
        const output = new Float32Array(1024);
        const deadline = Date.now() + 19000;
        function poll() {
            if (state.error || state.complete) return;
            if (video.currentTime > 1.3 && frames >= 6 &&
                    video.videoWidth >= 100 && !video.paused) state.video = true;

            state.tapsConnected = !!(instrumented.before && instrumented.after);
            state.contextRunning = instrumented.context?.state === 'running';
            if (state.requested && !state.measured &&
                    state.contextRunning && state.tapsConnected) {
                instrumented.before.getFloatTimeDomainData(input);
                instrumented.after.getFloatTimeDomainData(output);
                const before = rms(input), after = rms(output);
                if (before > 0.05) state.inputDetected = true;
                if (after > 0.01) state.outputDetected = true;
                if (before > 0.05 && after > 0.01 &&
                        after < before * 0.78) {
                    state.attenuationDetected = true;
                    goodWindows++;
                }
                if (goodWindows >= 5 && video.currentTime > 0.65) {
                    state.measured = true;
                }
            }
            if (state.video && state.requested && state.measured && !offSent) {
                offSent = true;
                engine.dispatch({type:'command',commandName:'setNightAudio',
                    commandArgs:{profile:{when:'off'}}});
            }
            if (state.video && state.measured && state.off) {
                state.complete = document.getElementById('app')?.children.length > 0;
                if (!state.complete) state.error = true;
                return;
            }
            if (Date.now() < deadline) setTimeout(poll, 110);
            else state.error = true;
        }
        setTimeout(poll, 180);
    });

    window.addEventListener('pagehide', () => {
        window.AudioContext = actualAudioContext;
        engine.destroy();
        if (url) URL.revokeObjectURL(url);
    }, {once:true});
    prepare().catch(() => { state.error = true; });
})();
