'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');

// This repair is restricted to the reviewed immutable Core package.
const expectedUrl = 'https://raw.githubusercontent.com/ThiaJay/stremio-core/194999e3e4048c37da86c7a4506316bc2542a266/stremio-core-web/integration/universal-player-core/dev/stremio-stremio-core-web-0.63.1.tgz';
const expectedBlob = '89a98d0885b76979793dde7c6ba224962ec3acf5';
async function main() {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (pkg.dependencies['@stremio/stremio-core-web'] !== expectedUrl) throw new Error('Core source pin changed');
    const response = await fetch(expectedUrl, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.body) throw new Error('Core package unavailable');
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
        length += chunk.byteLength;
        if (length > 32000000) throw new Error('Core package exceeds bound');
        chunks.push(Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);
    const blob = crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    if (blob !== expectedBlob) throw new Error('Core package differs from reviewed Git blob');
    const integrity = 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64');
    const before = 'resolution: {tarball: ' + expectedUrl + '}';
    const after = 'resolution: {integrity: ' + integrity + ', tarball: ' + expectedUrl + '}';
    const lock = fs.readFileSync('pnpm-lock.yaml', 'utf8');
    if (lock.includes(after)) {
        console.log('Core integrity is already verified');
        return;
    }
    if (lock.split(before).length !== 2) throw new Error('Unexpected Core lockfile entry');
    fs.writeFileSync('pnpm-lock.yaml.verified', lock.replace(before, after));
    fs.renameSync('pnpm-lock.yaml.verified', 'pnpm-lock.yaml');
    console.log(JSON.stringify({ sourceBlob: blob, integrity }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
