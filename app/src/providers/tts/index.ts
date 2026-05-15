import { getCurrentLocale } from '../../lib/i18n-leaf.ts';
import type { TTSConfig, SupportedLocale } from '../../types';

// ─── FILTER-03 / D-13 bracketing exemption ──────────────────────────
// TTS providers do not interpret the `text` field as instructions —
// they vocalize it. Wrapping `text` in `<text_to_speak>...</text_to_speak>`
// would either (a) be silently dropped by some providers OR
// (b) be pronounced literally as "less-than text-to-speak greater-than".
// Neither is desirable. TTS is therefore EXEMPT from D-13 bracketing.
// See 47-RESEARCH.md §"TTS wrapper bracketing" (lines 845-851).
// Negative-invariant test at app/tests/providers/tts-bracketing-exempt.test.mjs
// asserts the bracketing helper from providers/llm is NOT imported here.

// ─── Locale-aware TTS voice (D-13) ────────────────────────────────────────────
// When the user has the default 'alloy' voice, pick a locale-appropriate
// voice. If the user explicitly chose another voice in SettingsScreen, respect
// that regardless of locale.
// NOTE: `LOCALE_VOICE_FALLBACK` is duplicated across providers (llm/tts) to
// keep each provider JSON-free so `node --test` on Node 25 can import them
// without JSON-import-attribute errors on src/locales/*.json.
const LOCALE_VOICE_FALLBACK: Record<SupportedLocale, string> = {
  en: 'alloy',
  zh: 'nova',
  es: 'nova',
  ja: 'nova',
};

function timeoutSignal(ms: number): AbortSignal {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(new DOMException(`Request timed out after ${ms / 1000}s`, 'TimeoutError')), ms);
  ac.signal.addEventListener('abort', () => clearTimeout(id), { once: true });
  return ac.signal;
}

function resolveVoice(config: TTSConfig): string {
  const lng = getCurrentLocale() as SupportedLocale;
  const locale: SupportedLocale = lng in LOCALE_VOICE_FALLBACK ? lng : 'en';
  // Respect user override: any voice other than the default 'alloy' means
  // the user intentionally picked it in SettingsScreen — don't override.
  if (config.voice && config.voice !== 'alloy') return config.voice;
  return LOCALE_VOICE_FALLBACK[locale];
}

export async function synthesize(text: string, config: TTSConfig): Promise<string> {
  const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com';
  const voice = resolveVoice(config);
  const response = await window.fetch(`${baseUrl}/v1/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice,
      speed: config.speed,
    }),
    signal: timeoutSignal(60_000),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`TTS API error ${response.status}: ${err}`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function testTTSConnection(
  config: TTSConfig,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const blobUrl = await synthesize('Hello.', config);
    URL.revokeObjectURL(blobUrl);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
