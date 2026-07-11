import assert from 'node:assert/strict';
import test from 'node:test';

const upload = (record, store) => store.has(record.id) ? 'duplicate' : (store.add(record.id), 'created');
test('canonical Q&A upload seam is idempotent', () => { const store = new Set(); const record = { id: 'q1' }; assert.equal(upload(record, store), 'created'); assert.equal(upload(record, store), 'duplicate'); });
