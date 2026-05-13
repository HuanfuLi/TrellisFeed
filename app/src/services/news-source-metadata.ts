import type { DailyPost, WebSearchResult } from '../types';
import { sourceDiversityService } from './source-diversity.service.ts';

export function selectNewsTopSources(
  results: WebSearchResult[],
  usedDomains: Set<string>,
): WebSearchResult[] {
  return sourceDiversityService.filterForDiversity(results, usedDomains).slice(0, 3);
}

export function mapNewsSourcesToNewsMeta(
  topSources: WebSearchResult[],
): NonNullable<DailyPost['newsMeta']>['sources'] {
  return topSources.slice(0, 3).map((r, i) => ({
    index: i + 1,
    title: r.title,
    url: r.url,
    snippet: r.content,
  }));
}
