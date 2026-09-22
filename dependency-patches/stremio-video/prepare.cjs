'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const moduleSource = fs.readFileSync(path.join(__dirname, 'AvSyncTelemetry.js'), 'utf8');
const shellPath = 'src/ShellVideo/ShellVideo.js';
const modulePath = 'src/ShellVideo/AvSyncTelemetry.js';

function replaceOnce(text, before, after) {
    assert.equal(text.split(before).length - 1, 1, 'Source anchor changed or is ambiguous');
    return text.replace(before, after);
}

function transform(source) {
    let next = replaceOnce(source, "var ERROR = require('../error');", "var ERROR = require('../error');\nvar AvSyncTelemetry = require('./AvSyncTelemetry');");
    next = replaceOnce(next, "    'videoScale': null,", "    'videoScale': null,\n    'avSync': null,");
    next = replaceOnce(next, '    var ipc = options.shellTransport;', '    var ipc = options.shellTransport;\n    var avSyncTelemetry = new AvSyncTelemetry();\n    var avSyncSeeking = true;');
    next = replaceOnce(next, "    ipc.send('mpv-observe-prop', 'seeking');", "    ipc.send('mpv-observe-prop', 'seeking');\n    ipc.send('mpv-observe-prop', 'avsync');");
    next = replaceOnce(next, "    ipc.on('mpv-prop-change', function(args) {\n        switch (args.name) {", "    ipc.on('mpv-prop-change', function(args) {\n        if (destroyed || !args) return;\n        if (args.name === 'seeking') avSyncSeeking = args.data !== false;\n        if (['path', 'pause', 'seeking', 'paused-for-cache', 'aid', 'vid', 'eof-reached'].indexOf(args.name) !== -1) {\n            avSyncTelemetry.reset();\n            onPropChanged('avSync');\n        }\n        if (args.name === 'avsync') {\n            if (avSyncTelemetry.observe(args.data, avSyncActive())) onPropChanged('avSync');\n            return;\n        }\n        switch (args.name) {");
    next = replaceOnce(next, '    function getProp(propName) {', "    function avSyncActive() {\n        return !destroyed && stream !== null && props.loaded === true &&\n            props.pause === false && props.buffering === false && !avSyncSeeking &&\n            typeof props.aid === 'string' && typeof props.vid === 'string';\n    }\n    function getProp(propName) {\n        if (propName === 'avSync') return avSyncTelemetry.snapshot(avSyncActive());");
    next = replaceOnce(next, "            case 'unload': {", "            case 'unload': {\n                avSyncTelemetry.reset();\n                onPropChanged('avSync');");
    return next;
}

function main() {
    const verify = process.argv[2] === '--verify-installed';
    const root = verify ? path.dirname(require.resolve('@stremio/stremio-video/package.json')) : path.resolve(process.argv[2] || '');
    assert.ok(verify || process.argv[2], 'A pnpm patch directory is required');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.name, '@stremio/stremio-video');
    assert.equal(pkg.version, '0.0.98', 'Do not apply this patch to another release');
    assert.equal(pkg.license, 'MIT', 'Preserve the upstream licence');
    const source = fs.readFileSync(path.join(root, shellPath), 'utf8');
    if (verify) {
        const proof = JSON.parse(fs.readFileSync('playback-dependency-proof.json', 'utf8'));
        assert.equal(sha256(source), proof.shellAfterSha256);
        assert.equal(fs.readFileSync(path.join(root, modulePath), 'utf8'), moduleSource);
        assert.equal(source.includes("commands: ['load', 'unload', 'destroy']"), true, 'No unvalidated correction command may be advertised');
        const ShellVideo = require(path.join(root, shellPath));
        assert.ok(ShellVideo.manifest.props.includes('avSync'));
        assert.ok(!ShellVideo.manifest.commands.includes('correctAvSync'));
        console.log('Installed native playback dependency matches the validated patch');
        return;
    }
    const next = transform(source);
    assert.ok(!fs.existsSync(path.join(root, modulePath)), 'Do not overwrite an existing native adapter');
    fs.writeFileSync(path.join(root, shellPath), next);
    fs.writeFileSync(path.join(root, modulePath), moduleSource);
    fs.writeFileSync('playback-dependency-proof.json', JSON.stringify({
        schemaVersion: 1,
        package: pkg.name,
        version: pkg.version,
        upstream: 'https://github.com/Stremio/stremio-video',
        licence: pkg.license,
        sourceCommit: process.env.GITHUB_SHA || null,
        shellBeforeSha256: sha256(source),
        shellAfterSha256: sha256(next),
        telemetrySha256: sha256(moduleSource),
        changedPackageFiles: [shellPath, modulePath],
        nativeCorrectionsEnabled: false,
        productionDeployment: false
    }, null, 2) + '\n');
    console.log('Prepared the exact released MPV adapter for a pnpm dependency patch');
}

module.exports = { transform, replaceOnce };
if (require.main === module) main();
