import { settingsService } from './settings.service.ts';

export type ParticipantRouteDecision = 'research-setup' | 'onboarding' | 'participant';

export function hasAffirmativeResearchConsent(): boolean {
  const { onboardingCompleted, aiConsentGiven } = settingsService.getSync().preferences;
  return onboardingCompleted === true && aiConsentGiven === true;
}

export function resolveParticipantRoute(
  isBound: boolean,
  hasConsent = hasAffirmativeResearchConsent(),
): ParticipantRouteDecision {
  if (!isBound) return 'research-setup';
  return hasConsent ? 'participant' : 'onboarding';
}
