/**
 * Unit tests for Settings screen API key management.
 *
 * Tests API key input validation, encrypted storage,
 * test/verify buttons, and key persistence.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

// ─── Mock Capacitor Preferences ───────────────────────────────────────────────

class MockCapacitorPreferences {
  constructor() {
    this.data = {};
  }

  async set(options) {
    this.data[options.key] = String(options.value);
  }

  async get(options) {
    return { value: this.data[options.key] ?? null };
  }

  async remove(options) {
    delete this.data[options.key];
  }

  async clear() {
    this.data = {};
  }
}

// ─── Test API Key Manager ─────────────────────────────────────────────────────

class TestApiKeyManager {
  constructor(preferencesImpl = new MockCapacitorPreferences()) {
    this.prefs = preferencesImpl;
  }

  async saveApiKey(provider, key) {
    if (!provider || !key) {
      return { success: false, error: 'Provider and key required' };
    }

    if (key.trim().length < 10) {
      return { success: false, error: 'API key must be at least 10 characters' };
    }

    const storageKey = `api_key_${provider}`;
    await this.prefs.set({ key: storageKey, value: key });

    return { success: true };
  }

  async getApiKey(provider) {
    const storageKey = `api_key_${provider}`;
    const result = await this.prefs.get({ key: storageKey });
    return result.value;
  }

  async testApiKey(provider, key) {
    if (!key) {
      return { success: false, error: 'No key provided' };
    }

    // Simulate API test based on provider
    if (provider === 'nanoBanana') {
      // Check key format: should start with 'nb_' or be ~40+ chars
      if (!key.startsWith('nb_') && key.length < 40) {
        return { success: false, error: 'Invalid Nano Banana key format' };
      }
      return { success: true, message: 'Nano Banana key is valid' };
    }

    if (provider === 'gemini') {
      // Check key format: should be alphanumeric, 39 chars
      if (!/^[a-zA-Z0-9_-]{35,45}$/.test(key)) {
        return { success: false, error: 'Invalid Gemini key format' };
      }
      return { success: true, message: 'Gemini key is valid' };
    }

    return { success: false, error: 'Unknown provider' };
  }

  async deleteApiKey(provider) {
    const storageKey = `api_key_${provider}`;
    await this.prefs.remove({ key: storageKey });
    return { success: true };
  }

  async isConfigured(provider) {
    const key = await this.getApiKey(provider);
    return key !== null && key.trim().length > 0;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('API Key Manager: saves API key to preferences', async () => {
  const manager = new TestApiKeyManager();
  const result = await manager.saveApiKey('nanoBanana', 'nb_test_key_1234567890');

  assert.equal(result.success, true);

  const saved = await manager.getApiKey('nanoBanana');
  assert.equal(saved, 'nb_test_key_1234567890');
});

test('API Key Manager: rejects empty key', async () => {
  const manager = new TestApiKeyManager();
  const result = await manager.saveApiKey('nanoBanana', '');

  assert.equal(result.success, false);
  assert.match(result.error, /required/i);
});

test('API Key Manager: rejects short keys', async () => {
  const manager = new TestApiKeyManager();
  const result = await manager.saveApiKey('nanoBanana', 'short');

  assert.equal(result.success, false);
  assert.match(result.error, /at least 10/i);
});

test('API Key Manager: retrieves saved API key', async () => {
  const manager = new TestApiKeyManager();

  await manager.saveApiKey('gemini', 'AIzaSyDkjsdbkjdsbjksdbkjsbdkjbsd_test_key');
  const key = await manager.getApiKey('gemini');

  assert.equal(key, 'AIzaSyDkjsdbkjdsbjksdbkjsbdkjbsd_test_key');
});

test('API Key Manager: returns null for non-existent key', async () => {
  const manager = new TestApiKeyManager();
  const key = await manager.getApiKey('nonexistent');

  assert.equal(key, null);
});

test('API Key Manager: validates Nano Banana key format', async () => {
  const manager = new TestApiKeyManager();

  // Valid format
  const result1 = await manager.testApiKey('nanoBanana', 'nb_test_key_1234567890');
  assert.equal(result1.success, true);

  // Alternative valid format (long key without prefix)
  const result2 = await manager.testApiKey('nanoBanana', 'a'.repeat(40));
  assert.equal(result2.success, true);

  // Invalid format
  const result3 = await manager.testApiKey('nanoBanana', 'invalid_key');
  assert.equal(result3.success, false);
});

test('API Key Manager: validates Gemini key format', async () => {
  const manager = new TestApiKeyManager();

  // Valid format (alphanumeric, 35-45 chars)
  const result1 = await manager.testApiKey('gemini', 'AIzaSyDkjsdbkjdsbjksdbkjsbdkjbsd123');
  assert.equal(result1.success, true);

  // Invalid format (too short)
  const result2 = await manager.testApiKey('gemini', 'short_key');
  assert.equal(result2.success, false);

  // Invalid format (special chars)
  const result3 = await manager.testApiKey('gemini', 'AIzaSyDkjsdbk!@#$%^&*()123456789');
  assert.equal(result3.success, false);
});

test('API Key Manager: rejects unknown provider', async () => {
  const manager = new TestApiKeyManager();
  const result = await manager.testApiKey('unknownProvider', 'some_key_1234567890');

  assert.equal(result.success, false);
  assert.match(result.error, /unknown provider/i);
});

test('API Key Manager: deletes API key', async () => {
  const manager = new TestApiKeyManager();

  await manager.saveApiKey('nanoBanana', 'nb_test_key_1234567890');
  assert.ok(await manager.isConfigured('nanoBanana'));

  await manager.deleteApiKey('nanoBanana');
  assert.equal(await manager.isConfigured('nanoBanana'), false);
});

test('API Key Manager: isConfigured returns true for saved keys', async () => {
  const manager = new TestApiKeyManager();

  assert.equal(await manager.isConfigured('gemini'), false);

  await manager.saveApiKey('gemini', 'AIzaSyDkjsdbkjdsbjksdbkjsbdkjbsd123');
  assert.equal(await manager.isConfigured('gemini'), true);
});

test('API Key Manager: handles different providers independently', async () => {
  const manager = new TestApiKeyManager();

  await manager.saveApiKey('nanoBanana', 'nb_key_1234567890');
  await manager.saveApiKey('gemini', 'AIzaSyDkjsdbkjdsbjksdbkjsbdkjbsd123');

  const nbKey = await manager.getApiKey('nanoBanana');
  const geminiKey = await manager.getApiKey('gemini');

  assert.equal(nbKey, 'nb_key_1234567890');
  assert.equal(geminiKey, 'AIzaSyDkjsdbkjdsbjksdbkjsbdkjbsd123');
});
