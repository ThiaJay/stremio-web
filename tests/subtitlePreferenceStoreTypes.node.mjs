import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const gitBlob = async (name) => {
  const content = await readFile(new URL("../src/routes/Player/intelligentSubtitles/" + name, import.meta.url));
  return createHash('sha1')
    .update(`blob ${content.byteLength}\0`)
    .update(content)
    .digest('hex');
};

test('source declarations retain current exact Foundation identities', async () => {
  assert.equal(await gitBlob('preference-provenance.d.mts'), '0d988eb623279118ca21747d7f5db5960c4d400b');
  assert.equal(await gitBlob('preference-receipt.d.mts'), 'd01af99e9ea5c60f999c26b9c4597c6592341763');
});

test('store declaration exposes only the closed local-choice API', async () => {
  const declaration = await readFile(new URL("../src/routes/Player/intelligentSubtitles/preference-store.d.mts", import.meta.url), 'utf8');
  assert.match(declaration, /surface: 'first-run' \| 'subtitle-settings'/);
  assert.match(declaration, /sessionPreference: SubtitlePreference & \{ enabled: true \}/);
  assert.match(declaration, /import type \{[\s\S]*SubtitlePreference,[\s\S]*SubtitlePreferenceProvenance/);
  assert.match(declaration, /randomBytes: SubtitlePreferenceEntropySource/);
  assert.doesNotMatch(declaration, /account|migration|deviceId|packageName/i);
});

test('compiler fixture retains all four negative caller cases', async () => {
  const fixture = await readFile(new URL("./subtitle-provenance-types/preference-store.type-test.mts", import.meta.url), 'utf8');
  assert.equal((fixture.match(/@ts-expect-error/g) || []).length, 4);
  for (const marker of ['mandatory', 'account hydration', 'explicit Off', 'entropy']) {
    assert.match(fixture, new RegExp(marker, 'i'));
  }
});
