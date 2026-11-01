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
    assert.equal(await gitBlob('preference-provenance.d.mts'), '568addbd4dfc0caffdaa0e9636b0ffa518048c05');
    assert.equal(await gitBlob('preference-provenance.type-test.mts'), 'ce08c988effaf206e25fe71843cadc655b33ba81');
});

test('negative compiler cases remain present and exact', async () => {
    const fixture = await readFile(new URL('preference-provenance.type-test.mts', root), 'utf8');
    assert.equal((fixture.match(/@ts-expect-error/g) || []).length, 2);
    assert.match(fixture, /missingSurface/);
    assert.match(fixture, /forgedStoredSurface/);
});
