import { settingsService } from './settings.service.ts';

export type ParticipantRouteDecision = 'research-setup' | 'onboarding' | 'participant';

export const RESEARCH_CONSENT_VERSION = 1;

export function hasAffirmativeResearchConsent(): boolean {
  const {
    onboardingCompleted,
    researchConsentGiven,
    researchConsentVersion,
  } = settingsService.getSync().preferences;
  return onboardingCompleted === true
    && researchConsentGiven === true
    && researchConsentVersion === RESEARCH_CONSENT_VERSION;
}

export function resolveParticipantRoute(
  isBound: boolean,
  hasConsent = hasAffirmativeResearchConsent(),
): ParticipantRouteDecision {
  if (!isBound) return 'research-setup';
  return hasConsent ? 'participant' : 'onboarding';
}
