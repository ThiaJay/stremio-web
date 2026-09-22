'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
function edit(file, transform) {
    let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const once = (before, after) => { assert.equal(text.split(before).length - 1, 1, 'Web source anchor changed in ' + file); text = text.replace(before, after); };
    transform(once, text);
    fs.writeFileSync(file, text);
}
if (!fs.readFileSync('src/routes/Player/Player.js', 'utf8').includes("require('./useAvSyncV2')")) {
    edit('src/routes/Player/Player.js', (replace) => {
        replace("const useVideo = require('./useVideo');", "const useVideo = require('./useVideo');\nconst useAvSyncV2 = require('./useAvSyncV2');");
        replace('    const [seeking, setSeeking] = React.useState(false);', '    const [seeking, setSeeking] = React.useState(false);\n    useAvSyncV2(core, player, video, seeking);');
        replace('            video.load({\n                stream:', '            video.load({\n                avSyncSessionId: player.avSyncV2?.protocolVersion === 2 ? player.avSyncV2.sessionId : undefined,\n                stream:');
        replace('}, [streamingServer.baseUrl, player.selected, player.stream, streamSubtitles, forceTranscoding, casting, cancelKeyboardSeek]);', '}, [streamingServer.baseUrl, player.selected, player.stream, streamSubtitles, forceTranscoding, casting, cancelKeyboardSeek, player.avSyncV2?.sessionId]);');
    });
    edit('src/routes/Player/useVideo.js', (replace) => {
        replace('        avSync: null,', '        avSync: null,\n        avSyncV2: null,\n        avSyncV2Ack: null,');
        replace('    const load = React.useCallback((args, options) => {', '    const load = React.useCallback((args, options) => {\n        setState((state) => ({ ...state, avSyncV2: null, avSyncV2Ack: null }));');
        replace('    const unload = React.useCallback(() => {', '    const unload = React.useCallback(() => {\n        setState((state) => ({ ...state, avSyncV2: null, avSyncV2Ack: null }));');
        replace('    const correctAvSync = React.useCallback((correction) => {', `    const correctAvSyncV2 = React.useCallback((request) => {
        dispatch({ type: 'command', commandName: 'correctAvSyncV2', commandArgs: request });
    }, [dispatch]);

    const correctAvSync = React.useCallback((correction) => {`);
        replace('        correctAvSync,', '        correctAvSync,\n        correctAvSyncV2,');
        replace('            manifest,\n            live: null,', '            manifest,\n            avSyncV2: null,\n            avSyncV2Ack: null,\n            live: null,');
    });
    edit('src/core/types/models/Player.d.ts', (replace) => {
        replace('    avSync: AvSyncState,', '    avSync: AvSyncState,\n    avSyncV2?: AvSyncV2Controller,');
    });
}
const inputs = JSON.parse(fs.readFileSync('av-sync-v2-inputs.json', 'utf8'));
assert.match(inputs.corePackageCommit, /^[a-f0-9]{40}$/);
assert.match(inputs.videoCommit, /^[a-f0-9]{40}$/);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.dependencies['@stremio/stremio-core-web'] = `https://raw.githubusercontent.com/ThiaJay/stremio-core/${inputs.corePackageCommit}/stremio-core-web/feat/av-sync-session-safety/stremio-stremio-core-web-0.63.1.tgz`;
pkg.dependencies['@stremio/stremio-video'] = `https://codeload.github.com/ThiaJay/stremio-video/tar.gz/${inputs.videoCommit}`;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 4) + '\n');
console.log('Integrated the session safety bridge with immutable dependency sources');
