const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const repo = path.resolve(__dirname, '..');
const manifest = require('../package.json');
const provenance = require('../vendor/core-web/provenance.json');

const relativeTarball = 'vendor/core-web/stremio-stremio-core-web-0.65.0.tgz';
const tarball = path.join(repo, relativeTarball);

describe('Fork Core Web candidate package integrity', () => {
    test('the candidate uses a portable repository-local package rather than an external machine path or official fallback', () => {
        expect(manifest.dependencies['@stremio/stremio-core-web']).toBe('file:' + relativeTarball);
        expect(provenance.coreWebPackage).toBe('0.65.0');
        expect(provenance.coreSourceSha).toBe('303d7c0bb8bd6d55f11f2f751e55e66040da4f8c');
        expect(provenance.status).toMatch(/staged candidate only/);
    });

    test('the committed archive bytes match the source-bound SHA256 receipt', () => {
        const actual = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
        expect(actual).toBe(provenance.sha256);
        expect(fs.statSync(tarball).size).toBeGreaterThan(1000000);
    });

    test('the frozen lockfile resolves only the same vendored candidate', () => {
        const lock = fs.readFileSync(path.join(repo, 'pnpm-lock.yaml'), 'utf8');
        expect(lock).toContain('file:' + relativeTarball);
        expect(lock).not.toContain('file:../Artifacts/Packages');
    });

    test('the installed package contains the upgraded fork Core and native WebAssembly bridge', () => {
        const installedRoot = path.join(repo, 'node_modules', '@stremio', 'stremio-core-web');
        const installed = JSON.parse(fs.readFileSync(path.join(installedRoot, 'package.json'), 'utf8'));
        expect(installed.version).toBe(provenance.coreWebPackage);
        for (const file of ['stremio_core_web_bg.wasm', 'stremio_core_web.js', 'bridge.js', 'worker.js']) {
            expect(fs.statSync(path.join(installedRoot, file)).size).toBeGreaterThan(0);
        }
    });
});
