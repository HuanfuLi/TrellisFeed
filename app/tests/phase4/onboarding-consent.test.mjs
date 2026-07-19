import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const store = new Map();
globalThis.localStorage = {
  get length() { return store.size; },
  key(index) { return Array.from(store.keys())[index] ?? null; },
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); },
  clear() { store.clear(); },
};

const { dbExecute, dbQuery } = await import('../../src/services/db.service.ts');
const { settingsService } = await import('../../src/services/settings.service.ts');
const consentModule = await import('../../src/services/research-consent.service.ts');
const { studyContextService } = await import('../../src/services/study-context.service.ts');
const { createInteractionLog } = await import('../../src/services/interaction-log.service.ts');
const onboardingSource = await readFile(
  new URL('../../src/screens/OnboardingScreen.tsx', import.meta.url),
  'utf8',
);

const {
  RESEARCH_CONSENT_VERSION,
  hasAffirmativeResearchConsent,
  resolveParticipantRoute,
} = consentModule;

const basePreferences = {
  theme: 'system',
  locale: 'en',
  language: 'en',
  onboardingCompleted: true,
};

async function setPreferences(overrides) {
  const result = await settingsService.set('preferences', {
    ...basePreferences,
    ...overrides,
  });
  assert.equal(result.success, true);
}

test('legacy AI consent alone does not grant research consent or participant routing', async () => {
  await setPreferences({ aiConsentGiven: true });

  assert.equal(hasAffirmativeResearchConsent(), false);
  assert.equal(resolveParticipantRoute(true), 'onboarding');
});

test('missing or stale research consent versions fail the affirmative gate', async () => {
  await setPreferences({ researchConsentGiven: true });
  assert.equal(hasAffirmativeResearchConsent(), false);

  await setPreferences({
    researchConsentGiven: true,
    researchConsentVersion: RESEARCH_CONSENT_VERSION + 1,
  });
  assert.equal(hasAffirmativeResearchConsent(), false);
});

test('current research consent grants participant routing without consulting AI consent', async () => {
  await setPreferences({
    aiConsentGiven: false,
    researchConsentGiven: true,
    researchConsentVersion: RESEARCH_CONSENT_VERSION,
  });

  assert.equal(hasAffirmativeResearchConsent(), true);
  assert.equal(resolveParticipantRoute(true), 'participant');
});

test('interaction logging returns an event but does not persist legacy-only consent', async () => {
  await dbExecute('DELETE FROM research_metadata');
  await dbExecute('DELETE FROM research_records');
  await dbExecute('DELETE FROM research_upload_queue');
  await studyContextService.hydrate();
  await studyContextService.bindOnce({
    userId: '4044',
    condition: 'experimental',
    topicId: 'topic-opaque-1',
    boundAt: '2026-07-18T12:00:00.000Z',
  }, 'test-install-token-00000000000000004044');
  await setPreferences({ aiConsentGiven: true });

  const enqueued = [];
  const logger = createInteractionLog({
    enqueue: async (record) => { enqueued.push(record); },
    now: () => '2026-07-18T12:05:00.000Z',
    createId: () => 'legacy-consent-event',
  });

  const event = await logger.record('app_open');

  assert.equal(event.id, 'legacy-consent-event');
  assert.equal((await dbQuery('SELECT * FROM research_records')).length, 0);
  assert.equal((await dbQuery('SELECT * FROM research_upload_queue')).length, 0);
  assert.equal(enqueued.length, 0);
});

test('onboarding renders all five section 14.3 disclosures', () => {
  for (const key of [
    'itemLogging',
    'itemQaStorage',
    'itemOralRecording',
    'itemAnonymization',
    'itemWithdrawal',
  ]) {
    assert.match(onboardingSource, new RegExp(`t\\(['"]onboarding\\.consent\\.${key}['"]\\)`));
  }
});

test('onboarding remains three steps and grants current versioned consent', () => {
  assert.match(onboardingSource, /type Step = 'welcome' \| 'language' \| 'consent';/);
  assert.match(onboardingSource, /researchConsentGiven:\s*true/);
  assert.match(onboardingSource, /researchConsentVersion:\s*RESEARCH_CONSENT_VERSION/);
  assert.match(onboardingSource, /researchConsentGivenAt:\s*new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(onboardingSource, /apiKey|topic/i);
});
