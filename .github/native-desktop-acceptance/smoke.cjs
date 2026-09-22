const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

(async () => {
  const endpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9222';
  const out = process.env.ACCEPTANCE_OUT || 'native-desktop-receipt';
  fs.mkdirSync(out, { recursive: true });

  let browser;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      browser = await chromium.connectOverCDP(endpoint);
      break;
    } catch (error) {
      if (attempt === 59) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const contexts = browser.contexts();
  assert(contexts.length > 0, 'Qt WebEngine CDP exposed no browser context');
  const pages = contexts.flatMap(context => context.pages());
  assert(pages.length > 0, 'Qt WebEngine CDP exposed no page');
  const page = pages[0];

  await page.waitForFunction(() => Boolean(window.core), null, { timeout: 60000 });
  await page.waitForTimeout(1500);

  const state = await page.evaluate(async () => {
    const ua = navigator.userAgent;
    const ctx = await window.core.getState('ctx');
    return {
      href: location.href,
      userAgent: ua,
      shellUserAgent: /StremioShell\//.test(ua),
      qtTransportPresent: typeof window.qt === 'object' && window.qt !== null,
      bridgeGlobals: Object.keys(window).filter(key => /shell|transport|qt/i.test(key)).sort(),
      coreReady: Boolean(window.core),
      profileReady: Boolean(ctx && ctx.profile),
      title: document.title,
      bodyTextSample: document.body.innerText.slice(0, 1000),
    };
  });

  assert.equal(state.coreReady, true, 'Core worker did not initialise inside native shell');
  assert.equal(state.profileReady, true, 'Core profile state did not initialise inside native shell');
  assert.equal(state.shellUserAgent, true, 'Web UI is not running inside Stremio Shell user agent');
  assert.equal(state.qtTransportPresent, true, 'Qt WebChannel transport is not present');
  assert(state.href.startsWith('http://127.0.0.1:4173/'), 'Shell did not load the source-bound local Web build');

  fs.writeFileSync(`${out}/state.json`, JSON.stringify(state, null, 2));
  await page.screenshot({ path: `${out}/native-shell-FIXTURE.png`, fullPage: true });
  console.log(JSON.stringify(state, null, 2));
  await browser.close();
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
