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
