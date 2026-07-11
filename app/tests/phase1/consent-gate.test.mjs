import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../../src/App.tsx', import.meta.url), 'utf8');
const setupSource = await readFile(new URL('../../src/screens/ResearchSetupScreen.tsx', import.meta.url), 'utf8');
const onboardingSource = await readFile(new URL('../../src/screens/OnboardingScreen.tsx', import.meta.url), 'utf8');

test('all participant routes consume the shared affirmative consent gate', () => {
  assert.match(appSource, /resolveParticipantRoute/);
  assert.match(appSource, /hasAffirmativeResearchConsent/);
  assert.match(appSource, /function ParticipantRouteGate[\s\S]*resolveParticipantRoute/);
  assert.match(appSource, /function HomeRedirect[\s\S]*resolveParticipantRoute/);
  assert.match(appSource, /startResearchSession[\s\S]*hasAffirmativeResearchConsent/);
  for (const route of ['home', 'posts/:id', 'saved', 'settings']) {
    assert.match(appSource, new RegExp(`path: ['"]${route.replace('/', '\\/')}['"]`));
  }
});

test('setup continues to onboarding and onboarding has no skip bypass', () => {
  assert.match(setupSource, /navigate\(['"]\/onboarding['"]/);
  assert.doesNotMatch(setupSource, /navigate\(['"]\/home['"]/);
  assert.doesNotMatch(onboardingSource, /handleSkip/);
  assert.doesNotMatch(onboardingSource, /onboarding\.(welcome|consent)\.skip/);
  assert.match(onboardingSource, /aiConsentGiven:\s*true/);
});
