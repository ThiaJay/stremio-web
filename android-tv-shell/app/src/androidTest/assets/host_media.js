/* Android instrumentation APK only. Never bundle into application assets or release.
   No account, provider, external fixture, bridge or watched-state interaction. */
(() => {
    'use strict';
    if (location.origin !== 'https://appassets.androidplatform.net' ||
        location.pathname !== '/assets/web/index.html' ||
        window.__enhancedHostQa) return;

    const state = {ready: false, gesture: false, video: false, audio: false, error: false};
    Object.defineProperty(window, '__enhancedHostQa', {value: state, configurable: false});
    const panel = document.createElement('div');
    panel.id = 'enhanced-host-qa-panel';
    panel.style.cssText = 'position:fixed;inset:12px auto auto 12px;z-index:2147483647;padding:16px;background:#15242b;color:white';
    const button = document.createElement('button');
    button.id = 'enhanced-host-qa-start';
    button.textContent = 'Start original local media test';
    button.disabled = true;
    button.style.cssText = 'padding:12px;font-size:20px';
    const video = document.createElement('video');
    video.id = 'enhanced-host-qa-video';
    video.playsInline = true;
    video.preload = 'metadata';
    video.style.cssText = 'display:block;width:320px;height:180px;margin-top:12px';
    panel.append(button, video);
    document.body.appendChild(panel);
    let objectURL = null;
    let frames = 0;

    function rms(samples) {
        let power = 0;
        for (let i = 0; i < samples.length; i++) power += samples[i] * samples[i];
        return Math.sqrt(power / samples.length);
    }

    async function prepare() {
        const res = await fetch('/assets/web/qa-local.mp4',
            {cache: 'no-store', redirect: 'error', credentials: 'omit'});
        if (!res.ok) throw new Error('No local test fixture');
        const bytes = await res.arrayBuffer();
        if (bytes.byteLength < 15000 || bytes.byteLength > 4000000)
            throw new Error('Invalid local test fixture');
        objectURL = URL.createObjectURL(new Blob([bytes], {type: 'video/mp4'}));
        if (new URL(objectURL).origin !== location.origin)
            throw new Error('Local blob origin mismatch');
        video.src = objectURL;
        video.load();
        await new Promise((resolve, reject) => {
            if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return resolve();
            video.addEventListener('loadedmetadata', resolve, {once: true});
            video.addEventListener('error', () => reject(new Error('Video metadata')), {once: true});
            setTimeout(() => reject(new Error('Metadata timeout')), 15000);
        });
        if (video.videoWidth < 100 || video.videoHeight < 60 ||
            video.duration < 3 || video.duration > 8)
            throw new Error('Unexpected video metadata');
        button.disabled = false;
        button.focus();
        state.ready = true;
    }

    button.addEventListener('click', () => {
        if (!state.ready || state.gesture) return;
        state.gesture = true;
        button.disabled = true;
        if (typeof video.requestVideoFrameCallback !== 'function') {
            state.error = true;
            return;
        }
        const onFrame = (_time, metadata) => {
            frames = Math.max(frames, metadata.presentedFrames || 0);
            if (!video.ended) video.requestVideoFrameCallback(onFrame);
        };
        video.requestVideoFrameCallback(onFrame);

        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) {
            state.error = true;
            return;
        }
        let context, before, after;
        try {
            context = new AudioCtor();
            const source = context.createMediaElementSource(video);
            before = context.createAnalyser();
            after = context.createAnalyser();
            before.fftSize = 1024;
            after.fftSize = 1024;
            const compressor = context.createDynamicsCompressor();
            compressor.threshold.value = -54;
            compressor.knee.value = 0;
            compressor.ratio.value = 18;
            compressor.attack.value = 0.002;
            compressor.release.value = 0.08;
            source.connect(before);
            before.connect(compressor);
            compressor.connect(after);
            after.connect(context.destination);
            context.resume().catch(() => { state.error = true; });
        } catch (_error) {
            state.error = true;
            return;
        }
        video.play().catch(() => { state.error = true; });
        const input = new Float32Array(1024);
        const output = new Float32Array(1024);
        let compressedWindows = 0;
        const deadline = Date.now() + 14000;
        function poll() {
            if (!state.video && video.currentTime > 1.4 &&
                frames >= 6 && video.videoWidth >= 100) {
                state.video = true;
            }
            if (!state.audio && context.state === 'running') {
                before.getFloatTimeDomainData(input);
                after.getFloatTimeDomainData(output);
                const original = rms(input);
                const compressed = rms(output);
                if (original > 0.008 && compressed > 0.0008 &&
                    compressed < original * 0.86) compressedWindows++;
                if (compressedWindows >= 4 && video.currentTime > 0.6)
                    state.audio = true;
            }
            if (state.video && state.audio) return;
            if (Date.now() < deadline && !state.error) setTimeout(poll, 120);
            else state.error = true;
        }
        setTimeout(poll, 200);
    });
    window.addEventListener('pagehide', () => {
        if (objectURL) URL.revokeObjectURL(objectURL);
    }, {once: true});
    prepare().catch(() => { state.error = true; });
})();
