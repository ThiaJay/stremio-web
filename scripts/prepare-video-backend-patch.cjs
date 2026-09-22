'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Run only on the package directory created by pnpm patch.
const root = path.resolve(process.argv[2] || '.video-patch');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.name !== '@stremio/stremio-video' || pkg.version !== '0.0.98') {
    throw new Error('Unexpected video package identity');
}
const file = path.join(root, 'src/ShellVideo/ShellVideo.js');
let text = fs.readFileSync(file, 'utf8');
function replaceOnce(before, after) {
    if (text.split(before).length !== 2) throw new Error('Source anchor is missing or ambiguous');
    text = text.replace(before, after);
}
replaceOnce('    var props = {};', '    var props = {};\n    var loadEpoch = 0;');
replaceOnce(
    '                    waitForMPVVersion.then(function (mpvVersion) {',
    '                    var requestedLoadEpoch = loadEpoch;\n' +
    '                    waitForMPVVersion.then(function (mpvVersion) {\n' +
    '                        if (destroyed || requestedLoadEpoch !== loadEpoch) return;'
);
replaceOnce(
    "                var wasASSSubtitlesStylingActive = props.assSubtitlesStylingActive === true;",
    "                loadEpoch += 1;\n                stream = null;\n" +
    "                var wasASSSubtitlesStylingActive = props.assSubtitlesStylingActive === true;"
);
replaceOnce(
    '    function getProp(propName) {',
    "    function getProp(propName) {\n        if (propName === 'stream') return stream;"
);
for (const event of ['mpv-prop-change', 'mpv-event-ended', 'mpv-event-video-ready']) {
    replaceOnce(
        "    ipc.on('" + event + "', function(args) {",
        "    ipc.on('" + event + "', function(args) {\n        if (destroyed) return;"
    );
}
replaceOnce(
    "                if (args.name === 'paused-for-cache') {\n" +
    "                    props[args.name] = args.data;\n" +
    "                    updateLoaded();\n" +
    "                }\n" +
    "                if(props.buffering !== args.data) {\n" +
    "                    props.buffering = args.data;",
    "                props[args.name] = args.data;\n" +
    "                if (args.name === 'paused-for-cache') {\n" +
    "                    updateLoaded();\n" +
    "                }\n" +
    "                var buffering = props['paused-for-cache'] === true || props.seeking === true;\n" +
    "                if(props.buffering !== buffering) {\n" +
    "                    props.buffering = buffering;"
);
fs.writeFileSync(file, text);
console.log('Prepared a bounded ShellVideo lifecycle patch');
