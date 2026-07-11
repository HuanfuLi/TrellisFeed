/**
 * Public build-time values for the research client.
 *
 * Vite exposes every `VITE_*` value in the app bundle. This module therefore
 * accepts only the collection endpoint and an optional one-way PIN digest;
 * credentials, raw PINs, provider keys, and researcher passwords are never
 * client configuration.
 */
export interface ResearchConfig {
  apiBaseUrl: string;
  pinSha256?: string;
}

const SHA256_HEX = /^[a-f0-9]{64}$/i;

function resolveBaseUrl(rawValue: string | undefined): string {
  const value = rawValue?.trim();
  if (!value) {
    throw new Error('VITE_RESEARCH_API_BASE_URL is required for a research build');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('VITE_RESEARCH_API_BASE_URL must be a valid absolute URL');
  }

  if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || parsed.username || parsed.password) {
    throw new Error('VITE_RESEARCH_API_BASE_URL must be a public http(s) URL without credentials');
  }

  return parsed.toString().replace(/\/$/, '');
}

/** Resolve and validate the non-secret values injected into a research build. */
export function resolveResearchConfig(env = import.meta.env): ResearchConfig {
  const apiBaseUrl = resolveBaseUrl(env.VITE_RESEARCH_API_BASE_URL);
  const pinSha256 = env.VITE_RESEARCH_PIN_SHA256?.trim();

  if (pinSha256 && !SHA256_HEX.test(pinSha256)) {
    throw new Error('VITE_RESEARCH_PIN_SHA256 must be a SHA-256 hex digest');
  }

  return pinSha256 ? { apiBaseUrl, pinSha256: pinSha256.toLowerCase() } : { apiBaseUrl };
}

/** Validated public research configuration, resolved when the app bundle starts. */
export const researchConfig = resolveResearchConfig();
