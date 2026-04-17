/**
 * Web Search Service — Tavily API wrapper with citation extraction.
 *
 * serviceName: 'web-search' (for future token tracking)
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { settingsService } from './settings.service.ts';
import type { ServiceResult, WebSearchResult, WebSearchResponse, SourceCitation } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebSearchOptions {
  topic?: 'general' | 'news';
  maxResults?: number;
  includeImages?: boolean;
}

// ─── Web Search ───────────────────────────────────────────────────────────────

export async function webSearch(
  query: string,
  options?: WebSearchOptions,
): Promise<ServiceResult<WebSearchResponse>> {
  const settings = settingsService.getSync();
  const apiKey = settings.webSearch?.tavilyApiKey;

  if (!apiKey) {
    return {
      success: false,
      error: {
        code: 'NOT_CONFIGURED',
        message: 'Tavily API key not set. Add it in Settings > Web Search.',
        retryable: false,
      },
    };
  }

  const url = 'https://api.tavily.com/search';
  const body: Record<string, unknown> = {
    query,
    topic: options?.topic ?? 'general',
    max_results: options?.maxResults ?? 5,
    search_depth: 'basic',
    include_answer: false,
    include_raw_content: false,
  };
  if (options?.includeImages) {
    body.include_images = true;
  }
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  try {
    const startTime = Date.now();
    let responseData: unknown;

    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.post({ url, headers, data: body });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Tavily API error ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
      }
      responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    } else {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Tavily API error ${res.status}: ${errText}`);
      }
      responseData = await res.json();
    }

    const elapsed = Date.now() - startTime;
    const data = responseData as { results?: Array<{ title: string; url: string; content: string; score: number }>; images?: string[]; query?: string };

    const results: WebSearchResult[] = (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    }));

    return {
      success: true,
      data: {
        results,
        images: data.images,
        query: data.query ?? query,
        responseTime: elapsed,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'SEARCH_FAILED',
        message: err instanceof Error ? err.message : 'Web search failed',
        retryable: true,
      },
    };
  }
}

// ─── Citation Extraction ──────────────────────────────────────────────────────

export function extractCitations(content: string): { body: string; sources: SourceCitation[] } {
  // Look for "Sources:" or "References:" header
  const dividerMatch = content.match(/\n\s*(?:Sources|References)\s*:\s*\n/);

  if (!dividerMatch || dividerMatch.index === undefined) {
    return { body: content, sources: [] };
  }

  const body = content.slice(0, dividerMatch.index).trimEnd();
  const sourcesBlock = content.slice(dividerMatch.index + dividerMatch[0].length);

  const sources: SourceCitation[] = [];

  // Try multiple formats LLMs commonly output:
  // Format 1: [N] [Title](URL) — markdown link
  // Format 2: [N] Title - URL or [N] Title: URL — plain text
  // Format 3: [N] URL — bare URL
  const lines = sourcesBlock.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    // Format 1: markdown link [N] [Title](URL)
    const mdMatch = line.match(/\[(\d+)\]\s*\[([^\]\n]+?)\]\s*\(([^)\n]+)\)/);
    if (mdMatch) {
      sources.push({ index: parseInt(mdMatch[1], 10), title: mdMatch[2], url: mdMatch[3] });
      continue;
    }
    // Format 2: [N] Title - URL or [N] Title: URL
    const plainMatch = line.match(/\[(\d+)\]\s*(.+?)\s*[-–—:]\s*(https?:\/\/\S+)/);
    if (plainMatch) {
      sources.push({ index: parseInt(plainMatch[1], 10), title: plainMatch[2].trim(), url: plainMatch[3] });
      continue;
    }
    // Format 3: [N] URL (title derived from domain)
    const bareMatch = line.match(/\[(\d+)\]\s*(https?:\/\/\S+)/);
    if (bareMatch) {
      const domain = new URL(bareMatch[2]).hostname.replace('www.', '');
      sources.push({ index: parseInt(bareMatch[1], 10), title: domain, url: bareMatch[2] });
    }
  }

  return { body, sources };
}
