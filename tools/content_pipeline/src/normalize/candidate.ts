import { createHash } from 'node:crypto';
import type { ExtractedTextBlock, TextBlockKind } from '../extract/article.ts';

export interface CandidateInput {
  id: string;
  kind: 'article' | 'video';
  sourceUrl: string;
  sourceName?: string;
  author?: string;
  title: string;
  publicationDate?: string;
  excerpt?: string;
  language?: string;
  durationSeconds?: number;
  fullText: string;
  blocks: ExtractedTextBlock[];
  rawMetadata?: Record<string, unknown>;
  collectedAt: string;
  collectorVersion: string;
  extractionMethod?: string;
  videoId?: string;
}

export interface NormalizedBlock { id: string; kind: TextBlockKind; text: string }
export interface NormalizedCandidate extends Omit<CandidateInput, 'blocks' | 'sourceUrl' | 'publicationDate' | 'language' | 'durationSeconds' | 'fullText'> {
  canonicalUrl: string;
  publicationDate?: string;
  language?: string;
  durationSeconds?: number;
  fullText: string;
  blocks: NormalizedBlock[];
  contentHash: string;
}

const text = (value: string | undefined): string => (value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const hash = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

function canonicalUrl(input: string): string {
  const url = new URL(input);
  url.hash = '';
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  url.hostname = url.hostname.toLowerCase();
  url.searchParams.sort();
  return url.href;
}

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : date.toISOString().slice(0, 10);
}

export function normalizeCandidate(input: CandidateInput): NormalizedCandidate {
  const blocks = input.blocks.map((block) => ({ kind: block.kind, text: text(block.text) })).filter((block) => block.text).map((block, index) => ({
    id: `b-${String(index).padStart(4, '0')}-${hash(`${block.kind}\0${block.text}`).slice(0, 10)}`,
    ...block,
  }));
  const fullText = blocks.map((block) => block.text).join('\n\n');
  if (!fullText) throw new Error('normalized candidate requires extracted text');
  return {
    ...input,
    title: text(input.title), sourceName: text(input.sourceName) || undefined, author: text(input.author) || undefined,
    excerpt: text(input.excerpt) || fullText.slice(0, 280), canonicalUrl: canonicalUrl(input.sourceUrl),
    publicationDate: normalizeDate(input.publicationDate), language: text(input.language).toLowerCase() || undefined,
    durationSeconds: input.durationSeconds === undefined ? undefined : Math.max(0, Math.round(input.durationSeconds)),
    fullText, blocks, contentHash: hash(fullText), rawMetadata: input.rawMetadata ?? {},
  };
}

export function normalizeYouTubeCandidate(input: Omit<CandidateInput, 'kind' | 'fullText' | 'blocks'> & { videoId: string }): NormalizedCandidate {
  const url = canonicalUrl(input.sourceUrl);
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(input.videoId)) throw new Error('invalid YouTube video id');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.youtube.com' || parsed.pathname !== '/watch' || parsed.searchParams.get('v') !== input.videoId) {
    throw new Error('video source must be a canonical public YouTube URL');
  }
  return {
    ...input,
    kind: 'video',
    title: text(input.title) || `YouTube video ${input.videoId}`,
    sourceName: text(input.sourceName) || 'YouTube',
    author: text(input.author) || undefined,
    excerpt: text(input.excerpt) || undefined,
    canonicalUrl: url,
    publicationDate: normalizeDate(input.publicationDate),
    language: text(input.language).toLowerCase() || undefined,
    durationSeconds: input.durationSeconds === undefined ? undefined : Math.max(0, Math.round(input.durationSeconds)),
    fullText: '',
    blocks: [{ id: `video:${input.videoId}`, kind: 'paragraph', text: `Official Gemini YouTube URL input for video ${input.videoId}.` }],
    contentHash: hash(`youtube-url-v1\0${url}\0${input.videoId}`),
    rawMetadata: input.rawMetadata ?? {},
    extractionMethod: 'gemini-youtube-url',
  };
}
