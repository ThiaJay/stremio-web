import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = new URL('./subtitle-provenance-types/', import.meta.url);
const gitBlob = async (name) => {
    const content = await readFile(new URL(name, root));
    return createHash('sha1')
        .update(`blob ${content.length}\0`)
        .update(content)
        .digest('hex');
};

test('Web compiler input is bound to the reviewed Foundation declarations', async () => {
    assert.equal(await gitBlob('preference-provenance.d.mts'), '0d988eb623279118ca21747d7f5db5960c4d400b');
    assert.equal(await gitBlob('preference-receipt.d.mts'), 'd01af99e9ea5c60f999c26b9c4597c6592341763');
    assert.equal(await gitBlob('preference-provenance.type-test.mts'), '3617ac458ea710bf37f06e33bcb3db87b9dc9347');
});

test('negative compiler cases remain present and exact', async () => {
    const fixture = await readFile(new URL('preference-provenance.type-test.mts', root), 'utf8');
    assert.equal((fixture.match(/@ts-expect-error/g) || []).length, 3);
    assert.match(fixture, /missingSurface/);
    assert.match(fixture, /forgedStoredSurface/);
    assert.match(fixture, /forgedPreference/);
});
