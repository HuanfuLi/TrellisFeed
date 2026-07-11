import assert from 'node:assert/strict';
import test from 'node:test';

const renderModel = (asset) => ({ text: asset.body, html: undefined });
test('OriginalContent contract keeps source markup inert', () => assert.deepEqual(renderModel({ body: '<img onerror=alert(1)>' }), { text: '<img onerror=alert(1)>', html: undefined }));
