'use strict';
// Disposable, locally generated subtitle integration check. Never ship this.
// The audio language IDs below are synthetic metadata for exercising policy,
// NOT a claim that the generated sine wave contains English or French speech.
const StremioVideo = require('@stremio/stremio-video');
const policy = require('../../src/routes/Player/enhancedSubtitlePolicy.js');
(() => {
    const ORIGIN = 'https://appassets.androidplatform.net';
    if (location.origin !== ORIGIN || location.pathname !== '/assets/web/index.html' ||
        window.__enhancedSubtitleQa) return;

    const state = { ready:false, gesture:false, backend:false, trackListed:false,
        policyPassed:false, defaultOff:false, decoded:false, trackLoaded:false,
        cueVisible:false, restoredOff:false, complete:false, error:false };
    Object.defineProperty(window, '__enhancedSubtitleQa', {value:state});

    const fixture = Object.freeze({
        id:'ORIGINAL_ENGLISH_QA', lang:'eng', label:'English',
        content:'WEBVTT\n\n00:00:00.350 --> 00:00:04.700\nORIGINAL_QA_ENGLISH_SUBTITLE\n'
    });
    const cue = 'ORIGINAL_QA_ENGLISH_SUBTITLE';
    const panel = document.createElement('section');
    panel.id = 'enhanced-subtitles-qa';
    panel.style.cssText = 'position:fixed;top:15px;left:15px;z-index:2147483647;padding:12px;background:#163038;color:white';
    const button = document.createElement('button');
    button.id = 'enhanced-subtitles-qa-start';
    button.textContent = 'Check original English subtitles';
    button.style.cssText = 'padding:12px;font-size:20px';
    button.disabled = true;
    const container = document.createElement('div');
    container.id = 'enhanced-subtitles-qa-player';
    container.style.cssText = 'width:360px;height:200px;margin-top:10px';
    panel.append(button, container);
    document.body.appendChild(panel);

    const engine = new StremioVideo();
    let objectURL = null, media = null, selected = null;
    let startedAt = 0, frames = 0, issuedSubtitle = false, cleared = false;
    let selectedTrackLanguage = null;

    const decisions = (audioLanguage, overrides = {}) => policy.decide({
        options: policy.DEFAULT, streamReady:true,
        audioTracks:[{id:'synthetic-audio',lang:audioLanguage}],
        selectedAudioTrackId:'synthetic-audio',
        embeddedTracks:[], externalTracks:[fixture], ...overrides
    });

    function verifyPolicy() {
        const understood = decisions('eng');
        const bilingual = decisions('spa', {
            options:{...policy.DEFAULT,understoodLanguages:['en','es']}
        });
        const foreign = decisions('fra');
        const unknown = decisions('und');
        const manual = decisions('fra',{manualSubtitlePreference:true});
        const suspected = decisions('fra',{
            pictureEvidence:{sourceName:'Original hardcoded subs'}
        });
        const confirmed = decisions('fra',{
            pictureEvidence:{verifiedByViewer:true}
        });
        return understood.action === 'off' && understood.reason === 'audio_understood' &&
            bilingual.action === 'off' &&
            unknown.action === 'off' && unknown.reason === 'audio_language_unknown' &&
            foreign.action === 'select' && foreign.track?.source === 'external' &&
            foreign.track?.id === fixture.id && foreign.track?.language === 'en' &&
            manual.action === 'inherit' &&
            suspected.action === 'hold_off' && suspected.picture === 'suspected' &&
            confirmed.action === 'off' && confirmed.picture === 'confirmed';
    }

    function onProp(name, value) {
        if (name === 'selectedExtraSubtitlesTrackId') selected = value;
        if (name === 'extraSubtitlesTracks' && Array.isArray(value)) {
            const matching = value.find(t => t.id === fixture.id);
            if (matching && policy.language(matching.lang) === 'en') {
                state.trackListed = true;
                selectedTrackLanguage = 'en';
            }
        }
    }
    engine.on('implementationChanged', manifest => {
        state.backend = !!manifest && /^HTMLVideo/.test(manifest.name) &&
            manifest.commands?.includes('addExtraSubtitlesTracks') &&
            manifest.props?.includes('selectedExtraSubtitlesTrackId');
        if (state.backend) {
            engine.dispatch({type:'observeProp',propName:'extraSubtitlesTracks'});
            engine.dispatch({type:'observeProp',propName:'selectedExtraSubtitlesTrackId'});
        }
    });
    engine.on('propValue', onProp);
    engine.on('propChanged', onProp);
    engine.on('extraSubtitlesTrackLoaded', track => {
        if (track?.id === fixture.id) state.trackLoaded = true;
    });
    engine.on('error', () => { state.error = true; });

    function fail() { state.error = true; }
    function resetSelectedToOff() {
        engine.dispatch({type:'setProp',propName:'selectedExtraSubtitlesTrackId',propValue:null});
        engine.dispatch({type:'setProp',propName:'selectedSubtitlesTrackId',propValue:null});
    }
    async function prepare() {
        state.policyPassed = verifyPolicy();
        if (!state.policyPassed) throw Error('Policy regression');
        const response = await fetch('/assets/web/qa-local.mp4',
            {cache:'no-store',redirect:'error',credentials:'omit'});
        if (!response.ok) throw Error('Original fixture unavailable');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength < 15000 || bytes.byteLength > 4000000)
            throw Error('Unexpected original fixture size');
        objectURL = URL.createObjectURL(new Blob([bytes],{type:'video/mp4'}));
        if (new URL(objectURL).origin !== ORIGIN) throw Error('Invalid local media origin');
        engine.dispatch({type:'command',commandName:'load',commandArgs:{
            stream:{url:objectURL,subtitles:[fixture]},autoplay:false,time:0
        }},{containerElement:container});
        media = container.querySelector('video');
        if (!state.backend || !media || typeof media.requestVideoFrameCallback !== 'function')
            throw Error('Actual HTMLVideo backend unavailable');
        engine.dispatch({type:'observeProp',propName:'extraSubtitlesTracks'});
        engine.dispatch({type:'observeProp',propName:'selectedExtraSubtitlesTrackId'});
        await new Promise((resolve, reject) => {
            if (media.readyState >= HTMLMediaElement.HAVE_METADATA) return resolve();
            media.addEventListener('loadedmetadata',resolve,{once:true});
            media.addEventListener('error',()=>reject(Error('Actual video failed')),{once:true});
            setTimeout(()=>reject(Error('No media metadata')),15000);
        });
        if (media.videoWidth < 100 || media.videoHeight < 60 ||
            media.duration < 3 || media.duration > 8 || !state.trackListed ||
            selectedTrackLanguage !== 'en') throw Error('Media or track metadata unavailable');
        resetSelectedToOff();
        state.defaultOff = selected === null;
        if (!state.defaultOff) throw Error('Default track was enabled');
        button.disabled = false;
        button.focus();
        state.ready = true;
    }

    function poll() {
        if (state.error || state.complete) return;
        if (media.currentTime > 0.5 && frames >= 3 && media.videoWidth >= 100)
            state.decoded = true;

        if (!issuedSubtitle && state.decoded && media.currentTime < 4.1) {
            const decision = decisions('fra');
            if (decision.action !== 'select' || decision.track?.id !== fixture.id)
                return fail();
            issuedSubtitle = true;
            engine.dispatch({type:'setProp',propName:'selectedExtraSubtitlesTrackId',
                propValue:decision.track.id});
        }
        if (issuedSubtitle && state.trackLoaded && selected === fixture.id &&
            media.currentTime >= 0.8 && container.textContent?.includes(cue))
            state.cueVisible = true;

        if (!cleared && state.cueVisible) {
            cleared = true;
            resetSelectedToOff();
        }
        if (cleared && selected === null && !container.textContent?.includes(cue)) {
            state.restoredOff = true;
            state.complete = true;
            return;
        }
        if (Date.now() - startedAt < 16000 && !media.ended)
            setTimeout(poll,100);
        else fail();
    }
    button.addEventListener('click', () => {
        if (!state.ready || state.gesture || state.error) return;
        state.gesture = true;
        startedAt = Date.now();
        const frame = (_time, metadata) => {
            frames = Math.max(frames, metadata.presentedFrames || 0);
            if (!media.ended) media.requestVideoFrameCallback(frame);
        };
        media.requestVideoFrameCallback(frame);
        engine.dispatch({type:'setProp',propName:'paused',propValue:false});
        setTimeout(poll,120);
    });
    window.addEventListener('pagehide', () => {
        engine.destroy();
        if (objectURL) URL.revokeObjectURL(objectURL);
    },{once:true});
    prepare().catch(fail);
})();
