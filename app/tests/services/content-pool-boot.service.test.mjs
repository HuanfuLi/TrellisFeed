import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ContentPoolBootService } from '../../src/services/content-pool-boot.service.ts';

function poolHydrator(snapshots, calls) {
  let index = 0;
  return {
    async hydrate() {
      calls.push('pool');
      const snapshot = snapshots[Math.min(index, snapshots.length - 1)];
      index += 1;
      return { ...snapshot };
    },
  };
}

function graphLoader(results, calls) {
  let index = 0;
  return {
    async load() {
      calls.push('graph');
      const result = results[Math.min(index, results.length - 1)];
      index += 1;
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

describe('content pool boot barrier', () => {
  it('returns a non-ready pool snapshot unchanged without touching the graph', async () => {
    const calls = [];
    const snapshot = { status: 'error', version: 'pool-v1', errorCode: 'POOL_INVALID' };
    const service = new ContentPoolBootService({
      contentPool: poolHydrator([snapshot], calls),
      globalGraph: graphLoader([{ success: true }], calls),
    });

    assert.deepEqual(await service.hydrate(), snapshot);
    assert.deepEqual(calls, ['pool']);
  });

  it('awaits pool hydration before exactly one successful graph load', async () => {
    const calls = [];
    const ready = { status: 'ready', version: 'pool-v1' };
    const service = new ContentPoolBootService({
      contentPool: poolHydrator([ready], calls),
      globalGraph: graphLoader([{ success: true }], calls),
    });

    assert.deepEqual(await service.hydrate(), ready);
    assert.deepEqual(calls, ['pool', 'graph']);
  });

  it('maps graph load failure to the existing recoverable pool boundary', async () => {
    const calls = [];
    const ready = { status: 'ready', version: 'pool-v1' };
    const service = new ContentPoolBootService({
      contentPool: poolHydrator([ready], calls),
      globalGraph: graphLoader([{
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'graph unavailable', retryable: true },
      }], calls),
    });

    assert.deepEqual(await service.hydrate(), {
      status: 'error',
      version: 'pool-v1',
      errorCode: 'POOL_STORED_CORRUPT',
    });
    assert.deepEqual(calls, ['pool', 'graph']);
  });

  it('repeats the full barrier on retry and exposes ready only after graph recovery', async () => {
    const calls = [];
    const ready = { status: 'ready', version: 'pool-v1' };
    const service = new ContentPoolBootService({
      contentPool: poolHydrator([ready, ready], calls),
      globalGraph: graphLoader([new Error('first load failed'), { success: true }], calls),
    });

    assert.equal((await service.hydrate()).status, 'error');
    assert.deepEqual(await service.hydrate(), ready);
    assert.deepEqual(calls, ['pool', 'graph', 'pool', 'graph']);
  });
});
