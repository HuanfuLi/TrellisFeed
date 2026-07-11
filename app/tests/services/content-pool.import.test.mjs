import assert from 'node:assert/strict';
import test from 'node:test';

const importPool = async (bundle, persist) => persist({ version: bundle.version, status: 'ready' });
test('content pool import seam exposes ready state only after persistence', async () => {
  const writes = [];
  await importPool({ version: 'v1' }, async (row) => writes.push(row));
  assert.deepEqual(writes, [{ version: 'v1', status: 'ready' }]);
});
