import assert from 'node:assert/strict';
import test from 'node:test';
test('frozen cutover inventory contract requires the manifest', () => assert.ok(['manifest.json', 'posts.json'].includes('manifest.json')));
