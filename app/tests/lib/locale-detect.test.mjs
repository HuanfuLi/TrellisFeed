import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLocale, detectInitialLocale } from '../../src/lib/locale.ts';

test('normalizeLocale: BCP-47 variants', () => {
  assert.equal(normalizeLocale('en-US'), 'en');
  assert.equal(normalizeLocale('zh-CN'), 'zh');
  assert.equal(normalizeLocale('zh-Hans-CN'), 'zh');
  assert.equal(normalizeLocale('zh-TW'), 'zh');
  assert.equal(normalizeLocale('es-419'), 'es');
  assert.equal(normalizeLocale('es-MX'), 'es');
  assert.equal(normalizeLocale('ja-JP'), 'ja');
});

test('normalizeLocale: unsupported → en', () => {
  assert.equal(normalizeLocale('ko-KR'), 'en');
  assert.equal(normalizeLocale('fr-FR'), 'en');
});

test('normalizeLocale: nullish → en', () => {
  assert.equal(normalizeLocale(''), 'en');
  assert.equal(normalizeLocale(null), 'en');
  assert.equal(normalizeLocale(undefined), 'en');
});

test('detectInitialLocale: saved pref wins', () => {
  assert.equal(detectInitialLocale('zh'), 'zh');
  assert.equal(detectInitialLocale('ja'), 'ja');
});

test('detectInitialLocale: falls back to navigator.language', () => {
  const origDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'ja-JP', languages: ['ja-JP'] },
    configurable: true,
    writable: true,
  });
  try {
    assert.equal(detectInitialLocale(undefined), 'ja');
  } finally {
    if (origDescriptor) Object.defineProperty(globalThis, 'navigator', origDescriptor);
  }
});

test('detectInitialLocale: no navigator → en', () => {
  const origDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  try {
    assert.equal(detectInitialLocale(undefined), 'en');
  } finally {
    if (origDescriptor) Object.defineProperty(globalThis, 'navigator', origDescriptor);
  }
});
