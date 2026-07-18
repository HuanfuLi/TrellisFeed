import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../../src/screens/OnboardingScreen.tsx', import.meta.url), 'utf8');

test('filter corpus prewarm is gated by identity plus research and AI consent', () => {
  assert.match(appSource, /prewarmFilterCorpusIfAuthorized/);
  assert.match(appSource, /studyContextService\.isBound\(\)/);
  assert.match(appSource, /hasAffirmativeResearchConsent\(\)/);
  assert.match(appSource, /settings\.preferences\.aiConsentGiven/);
  assert.doesNotMatch(appSource, /void prewarmFilterCorpus\(settingsService\.getSync\(\)\.embedding\)/);
  assert.match(onboardingSource, /aiConsentGiven:\s*true[\s\S]*prewarmFilterCorpus\(settings\.embedding\)/);
});
