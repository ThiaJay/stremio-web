// Runs the real production Web bundle, real Core worker and local lawful media.
// Only network evidence is a fixture. Never label these images as real provider/device evidence.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium, firefox } = require('playwright');
const root = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
fs.mkdirSync(output, { recursive: true });
const results = [];
let base;
const media = fs.readFileSync(path.join(root, 'fixture.webm'));
const videos = [1, 2].map(episode => ({ id: `tt9999999:1:${episode}`, title: `Fixture episode ${episode}`,
    season: 1, episode, released: '2020-01-01T00:00:00.000Z' }));
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (url.pathname.endsWith('manifest.json') && url.pathname.startsWith('/fixture/')) {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ id: 'org.stremio.fixture', version: '1.0.0', name: 'Automated fixture',
            catalogs: [], types: ['series'], resources: ['meta', 'stream'], idPrefixes: ['tt9999999'] }));
    }
    if (url.pathname.startsWith('/fixture/meta/')) {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ meta: { id: 'tt9999999', type: 'series', name: 'AUTOMATED TEST FIXTURE',
            description: 'Controlled test media and segment responses. Not real provider evidence.', videos } }));
    }
    if (url.pathname.startsWith('/fixture/stream/')) {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ streams: [{ url: `${base}/fixture.webm?next`, name: 'Fixture next source',
            behaviorHints: { bingeGroup: 'runtime-fixture' } }] }));
    }
    let bytes;
    if (url.pathname === '/fixture.webm') { bytes = media; res.setHeader('Content-Type', 'video/webm'); }
    else {
        const name = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
        if (!name.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
        try { bytes = fs.readFileSync(name); } catch (_) { res.writeHead(404); return res.end(); }
        const ext = path.extname(name);
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
            '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml' })[ext] || 'application/octet-stream');
    }
    res.setHeader('Accept-Ranges', 'bytes');
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
        const start = Number(range[1]); const end = Math.min(Number(range[2] || bytes.length - 1), bytes.length - 1);
        if (start > end) { res.writeHead(416); return res.end(); }
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${bytes.length}`, 'Content-Length': end - start + 1 });
        return res.end(bytes.subarray(start, end + 1));
    }
    res.setHeader('Content-Length', bytes.length); res.end(bytes);
});
const packets = () => ({ segments: {
    recap: { start_ms: 2000, end_ms: 7000, confidence: 0.99, match: 'exact' },
    intro: { start_ms: 10000, end_ms: 20000, confidence: 0.99, match: 'exact' },
    outro: { start_ms: 100000, end_ms: 110000, confidence: 0.99, match: 'exact' },
} });
const settings = (page, mode, nextDuration = 0) => page.evaluate(async ({ mode, nextDuration }) => {
    const ctx = await window.core.getState('ctx');
    await window.core.dispatch({ action: 'Ctx', args: { action: 'UpdateSettings', args: {
        ...ctx.profile.settings, skipIntroMode: mode, nextVideoNotificationDuration: nextDuration,
    } } });
}, { mode, nextDuration });
const openVideo = async (page, episode = 1, take = 1) => {
    await page.evaluate(async ({ base, episode, take }) => {
        const stream = await window.core.encodeStream({ url: `${base}/fixture.webm?take=${take}`, name: 'Controlled test source',
            behaviorHints: { bingeGroup: 'runtime-fixture' } });
        location.hash = '#/player/' + [stream, base + '/fixture/manifest.json', base + '/fixture/manifest.json',
            'series', 'tt9999999', `tt9999999:1:${episode}`].map(encodeURIComponent).join('/');
    }, { base, episode, take });
    await page.waitForFunction(() => {
        const video = document.querySelector('video');
        return video && video.readyState >= 2 && Number.isFinite(video.duration) && video.currentTime > 0;
    }, null, { timeout: 20000 });
};
const at = async (page, seconds, paused = true) => {
    await page.locator('video').evaluate((video, { seconds, paused }) => {
        video.pause(); video.currentTime = seconds;
        if (!paused) return video.play();
    }, { seconds, paused });
    await page.waitForFunction(({ seconds }) => Math.abs(document.querySelector('video').currentTime - seconds) < 1,
        { seconds }, { timeout: 10000 });
};
const segmentKind = (page, kind) => page.waitForFunction(async kind => {
    const player = await window.core.getState('player');
    return player.skipSegment?.active && player.skipSegment?.kind === kind;
}, kind, { timeout: 15000 });
const noPrompt = async page => assert.equal(await page.locator('[role="group"][aria-label^="Skip "]').count(), 0);
const time = page => page.locator('video').evaluate(video => video.currentTime);
const pauseState = page => page.locator('video').evaluate(video => video.paused);

async function runCase(browser, engine, name, fn, policy = 'normal', viewport) {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: viewport || { width: 1280, height: 800 },
        hasTouch: Boolean(viewport), reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = []; const requests = []; const providers = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.tracing.start({ screenshots: true, snapshots: true });
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === base) return route.continue();
        requests.push(url.origin + url.pathname);
        if (route.request().resourceType() === 'script') {
            // Optional Cast and Apple SDK URLs must not receive JSON as JavaScript.
            return route.fulfill({ status: 200, contentType: 'text/javascript',
                body: '// Optional external SDK omitted from isolated fixture tests.' });
        }

        if (url.hostname === 'api.skipdb.tv') {
            providers.push(url.search);
            if (policy === 'outage') return route.abort();
            const data = packets();
            if (policy === 'invalid') data.segments = { intro: { start_ms: 10000, end_ms: 999999, confidence: 0.99, match: 'exact' } };
            if (policy === 'late') {
                if (url.searchParams.get('episode') === '1') await new Promise(r => setTimeout(r, 1800));
                else data.segments = {};
            }
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data),
                headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        // No request to an external provider, analytics service or personal account leaves the test.
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            metas: [], streams: [], subtitles: [], addons: [], result: {},
        }), headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    let status = 'PASS'; let failure = null;
    try {
        await page.goto(base + '/#/board');
        await page.waitForFunction(() => Boolean(window.core), null, { timeout: 20000 });
        await fn(page, providers);
        assert.equal(errors.length, 0, 'Unhandled runtime errors: ' + errors.join('; '));
    } catch (error) {
        status = 'FAIL'; failure = String(error.stack || error);
    } finally {
        try {
            fs.writeFileSync(path.join(output, `${engine}-${name}-state.json`), JSON.stringify(await page.evaluate(async () => ({
                location: location.hash, player: await window.core?.getState('player'),
                video: document.querySelector('video') ? { time: document.querySelector('video').currentTime,
                    duration: document.querySelector('video').duration, paused: document.querySelector('video').paused } : null,
            })), null, 2));
            await page.screenshot({ path: path.join(output, `${engine}-${name}-FIXTURE.png`) });
        } catch (_) { /* Original failure remains authoritative. */ }
        await context.tracing.stop({ path: path.join(output, `${engine}-${name}-trace.zip`) });
        results.push({ engine, name, status, failure, pageErrors: errors, providerRequests: providers.length,
            scope: viewport ? 'Mobile viewport emulation, not Android native' : 'Real compiled browser client with controlled network fixtures' });
        console.log(status, engine, name, failure || '');
        await context.close();
    }
}
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    for (const [engine, launcher] of [['chromium', chromium], ['firefox', firefox]]) {
        const browser = await launcher.launch({ headless: true, ...(engine === 'chromium' ? { args: ['--autoplay-policy=no-user-gesture-required'] } : {}) });
        await runCase(browser, engine, 'ask-and-space', async page => {
            await settings(page, 'ask'); await openVideo(page); await at(page, 12); await segmentKind(page, 'intro');
            const button = page.getByRole('button', { name: 'Skip Intro', exact: true });
            await button.waitFor(); await button.focus();
            await page.screenshot({ path: path.join(output, `${engine}-visible-popup-FIXTURE.png`) });
            const before = page.url(); await page.keyboard.press('Space');
            await page.waitForFunction(() => document.querySelector('video').currentTime >= 20);
            assert.equal(await pauseState(page), true); assert.equal(page.url(), before); await noPrompt(page);
        });
        await runCase(browser, engine, 'dismiss-and-expire', async page => {
            await settings(page, 'ask'); await openVideo(page); await at(page, 12); await segmentKind(page, 'intro');
            await page.getByRole('button', { name: 'Skip Intro', exact: true }).focus();
            const before = page.url(); await page.keyboard.press('Escape');
            await page.waitForTimeout(300); await noPrompt(page); assert.equal(page.url(), before); assert.equal(await time(page), 12);
            await openVideo(page, 2, 2); await at(page, 12); await segmentKind(page, 'intro');
            await page.getByRole('button', { name: 'Skip Intro', exact: true }).waitFor();
            await at(page, 25); await page.waitForTimeout(300); await noPrompt(page);
        });
        await runCase(browser, engine, 'pause-always-persistence', async page => {
            await settings(page, 'always'); await openVideo(page); await at(page, 12); await segmentKind(page, 'intro');
            await page.waitForTimeout(500); assert.equal(await time(page), 12); await noPrompt(page);
            await page.locator('video').evaluate(video => video.play());
            await page.waitForFunction(() => document.querySelector('video').currentTime >= 20);
            await page.reload(); await page.waitForFunction(() => Boolean(window.core));
            assert.equal(await page.evaluate(async () => (await window.core.getState('ctx')).profile.settings.skipIntroMode), 'always');
        });
        await runCase(browser, engine, 'never', async page => {
            await settings(page, 'never'); await openVideo(page); await at(page, 12); await page.waitForTimeout(800);
            await noPrompt(page); assert.equal(await time(page), 12);
        });
        await runCase(browser, engine, 'recap-remote-enter', async page => {
            await settings(page, 'ask'); await openVideo(page); await at(page, 3); await segmentKind(page, 'recap');
            const button = page.getByRole('button', { name: 'Skip Recap', exact: true }); await button.waitFor(); await button.focus();
            await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
            await page.waitForFunction(() => document.querySelector('video').currentTime >= 7);
            assert.equal(await pauseState(page), true);
        });
        await runCase(browser, engine, 'next-video-priority', async page => {
            await settings(page, 'always', 30000); await openVideo(page); await at(page, 101, false);
            await page.waitForTimeout(700); await noPrompt(page); assert((await time(page)) < 105);
            assert(page.url().includes('/player/')); assert(await page.locator('[class*="next-video-popup-container"]').count() > 0);
        });
        for (const policy of ['outage', 'invalid']) await runCase(browser, engine, policy, async (page, requests) => {
            await settings(page, 'ask'); await openVideo(page); await at(page, 12, false);
            await page.waitForTimeout(800); await noPrompt(page); assert((await time(page)) > 12);
            assert(requests.length > 0, 'Provider failure path was exercised');
        }, policy);
        await runCase(browser, engine, 'late-source-switch', async page => {
            await settings(page, 'ask'); await openVideo(page); await at(page, 12);
            await openVideo(page, 2, 99); await at(page, 12); await page.waitForTimeout(2300);
            await noPrompt(page);
            const player = await page.evaluate(() => window.core.getState('player'));
            assert.equal(player.selected.streamRequest.path.id, 'tt9999999:1:2');
            assert(!player.skipSegment || player.skipSegment.videoId === 'tt9999999:1:2');
        }, 'late');
        if (engine === 'chromium') await runCase(browser, engine, 'touch-popup', async page => {
            await settings(page, 'ask'); await openVideo(page); await at(page, 12); await segmentKind(page, 'intro');
            const button = page.getByRole('button', { name: 'Skip Intro', exact: true });
            await button.tap(); await page.waitForFunction(() => document.querySelector('video').currentTime >= 20);
        }, 'normal', { width: 390, height: 844 });
        await runCase(browser, engine, 'shared-consumption-rewind', async page => {
            await settings(page, 'ask'); await openVideo(page); await at(page, 3); await segmentKind(page, 'recap');
            await page.getByRole('button', { name: 'Skip Recap', exact: true }).click();
            await page.waitForFunction(() => document.querySelector('video').currentTime >= 7);
            await at(page, 12); await segmentKind(page, 'intro');
            await page.getByRole('button', { name: 'Skip Intro', exact: true }).click();
            await page.waitForFunction(() => document.querySelector('video').currentTime >= 20);
            await at(page, 3); await segmentKind(page, 'recap');
            const model = await page.evaluate(() => window.core.getState('player'));
            assert.equal(model.skipSegment.dismissed, true, 'Core must retain the earlier consumed recap');
            assert.equal(model.skipSegment.seekTo, null); await noPrompt(page);
            await settings(page, 'always');
            await page.locator('video').evaluate(video => video.play());
            await page.waitForTimeout(500); assert((await time(page)) < 5, 'Always mode must not replay consumed recap');
        });
        await runCase(browser, engine, 'prompt-survives-hidden-controls', async page => {
            await settings(page, 'ask'); await openVideo(page); await at(page, 11, false); await segmentKind(page, 'intro');
            await page.mouse.move(640, 400);
            await page.waitForFunction(() => Boolean(document.querySelector('[class*="overlayHidden"]')), null, { timeout: 6000 });
            await page.waitForFunction(() => getComputedStyle(document.querySelector('[class*="control-bar-layer"]')).opacity === '0');
            const prompt = page.getByRole('group', { name: 'Skip Intro', exact: true });
            assert.equal(await prompt.evaluate(node => getComputedStyle(node).opacity), '1');
            const box = await prompt.boundingBox(); assert(box && box.width > 100 && box.height > 30);
            await page.screenshot({ path: path.join(output, `${engine}-hidden-controls-visible-prompt-FIXTURE.png`) });
        });
        await runCase(browser, engine, 'settings-controls-and-persistence', async page => {
            await page.goto(base + '/#/settings');
            const option = page.getByText('Skip intros, recaps and credits', { exact: true }).locator('xpath=../..');
            await option.getByText('Ask', { exact: true }).click();
            await option.getByText('Always skip', { exact: true }).click();
            await page.waitForFunction(async () => (await window.core.getState('ctx')).profile.settings.skipIntroMode === 'always');
            await page.reload();
            await option.getByText('Always skip', { exact: true }).waitFor();
            await option.getByText('Always skip', { exact: true }).click();
            await option.getByText('Never', { exact: true }).click();
            await page.waitForFunction(async () => (await window.core.getState('ctx')).profile.settings.skipIntroMode === 'never');
            await option.getByText('Never', { exact: true }).click();
            await option.getByText('Ask', { exact: true }).click();
            await page.waitForFunction(async () => (await window.core.getState('ctx')).profile.settings.skipIntroMode === 'ask');
            await openVideo(page); await at(page, 12); await segmentKind(page, 'intro');
            await page.getByRole('button', { name: 'Skip Intro', exact: true }).waitFor();
        });
        await runCase(browser, engine, 'same-episode-new-source', async page => {
            await settings(page, 'ask'); await openVideo(page); await at(page, 12); await segmentKind(page, 'intro');
            const previous = await page.evaluate(async () => (await window.core.getState('player')).skipSegment.generation);
            await page.getByRole('button', { name: 'Skip Intro', exact: true }).click();
            await page.waitForFunction(() => document.querySelector('video').currentTime >= 20);
            await openVideo(page, 1, 77); await at(page, 12); await segmentKind(page, 'intro');
            const current = await page.evaluate(async () => (await window.core.getState('player')).skipSegment);
            assert(current.generation > previous); assert.equal(current.dismissed, false);
            await page.getByRole('button', { name: 'Skip Intro', exact: true }).waitFor();
        });

        await runCase(browser, engine, 'credits-seek-not-navigation', async page => {
            await settings(page, 'ask'); await openVideo(page); await at(page, 101); await segmentKind(page, 'outro');
            const before = page.url();
            const skip = page.getByRole('button', { name: 'Skip Credits', exact: true });
            await skip.waitFor();
            await page.screenshot({ path: path.join(output, `${engine}-credits-popup-FIXTURE.png`) });
            await skip.click();
            await page.waitForFunction(() => document.querySelector('video').currentTime >= 110);
            assert.equal(page.url(), before); assert.equal(await pauseState(page), true);
            const model = await page.evaluate(() => window.core.getState('player'));
            assert.equal(model.selected.streamRequest.path.id, 'tt9999999:1:1');
            await at(page, 101); await segmentKind(page, 'outro');
            const rewind = await page.evaluate(() => window.core.getState('player'));
            assert.equal(rewind.skipSegment.dismissed, true); await noPrompt(page);
        });
        await runCase(browser, engine, 'next-episode-plays-not-chooser', async page => {
            await settings(page, 'ask', 30000); await openVideo(page); await at(page, 101);
            const next = page.locator('[class*="next-video-popup-container"]');
            await next.waitFor(); await next.locator('[class*="play-button"]').click();
            await page.waitForFunction(async () => {
                const model = await window.core.getState('player');
                const video = document.querySelector('video');
                return model.selected?.streamRequest?.path?.id === 'tt9999999:1:2' &&
                    video?.currentSrc.endsWith('/fixture.webm?next') && video.readyState >= 2 &&
                    video.currentTime > 0.1 && video.currentTime < 5 && video.paused === false;
            }, null, { timeout: 20000 });
            const first = await time(page);
            await page.waitForFunction(first => {
                const video = document.querySelector('video');
                return video?.currentSrc.endsWith('/fixture.webm?next') && !video.paused && video.currentTime > first + 0.3;
            }, first, { timeout: 10000 });
            assert(page.url().includes('/player/')); await noPrompt(page);
        });
        await browser.close();
    }
    fs.writeFileSync(path.join(output, 'RESULTS.json'), JSON.stringify({ results, releaseReady: false,
        scope: 'Controlled network evidence and lawful local media. No Android native, TV device or real provider acceptance is claimed.' }, null, 2));
    process.exitCode = results.every(r => r.status === 'PASS') ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
