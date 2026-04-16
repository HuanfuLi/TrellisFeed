// YouTube Data API v3 URL builder with locale-aware params (D-14).
//
// Extracted into its own JSON-free module so `node --test` on Node 25 can
// exercise the URL construction directly without pulling in
// `youtube.service.ts`'s transitive LLM-provider chain (which breaks on
// extension-less `.ts` imports — see deferred-items.md).
//
// `youtube.service.ts` delegates to `buildYoutubeSearchUrl` to avoid
// duplication; both paths stay in lockstep.
import i18next from 'i18next';
import type { SupportedLocale } from '../types';

export const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

// Google [i18nLanguages](https://developers.google.com/youtube/v3/docs/i18nLanguages) /
// [i18nRegions](https://developers.google.com/youtube/v3/docs/i18nRegions) tags.
export const YOUTUBE_LOCALE_PARAMS: Record<
  SupportedLocale,
  { hl: string; regionCode: string; relevanceLanguage: string }
> = {
  en: { hl: 'en-US', regionCode: 'US', relevanceLanguage: 'en' },
  zh: { hl: 'zh-CN', regionCode: 'CN', relevanceLanguage: 'zh' },
  es: { hl: 'es', regionCode: 'ES', relevanceLanguage: 'es' },
  ja: { hl: 'ja', regionCode: 'JP', relevanceLanguage: 'ja' },
};

export interface BuildYoutubeSearchUrlArgs {
  query: string;
  maxResults: number;
  apiKey: string;
}

export function buildYoutubeSearchUrl(args: BuildYoutubeSearchUrlArgs): string {
  const { query, maxResults, apiKey } = args;
  const lng = i18next.language as SupportedLocale;
  const locale: SupportedLocale = lng in YOUTUBE_LOCALE_PARAMS ? lng : 'en';
  const { hl, regionCode, relevanceLanguage } = YOUTUBE_LOCALE_PARAMS[locale];

  return (
    `${YOUTUBE_SEARCH_URL}?part=snippet&type=video&videoEmbeddable=true` +
    `&q=${encodeURIComponent(query)}&maxResults=${maxResults}` +
    `&hl=${hl}&regionCode=${regionCode}&relevanceLanguage=${relevanceLanguage}` +
    `&safeSearch=strict&key=${apiKey}`
  );
}
