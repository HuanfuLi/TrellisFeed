import type { ExtractedTextBlock } from './article.ts';

export interface TranscriptAdapterResult {
  transcript: string;
  title?: string;
  channel?: string;
  publicationDate?: string;
  language?: string;
  durationSeconds?: number;
  rawMetadata?: Record<string, unknown>;
}

export type TranscriptAdapter = (videoId: string) => Promise<TranscriptAdapterResult>;

export interface YouTubeExtraction {
  videoId: string;
  title: string;
  sourceName?: string;
  publicationDate?: string;
  language?: string;
  durationSeconds?: number;
  fullText: string;
  blocks: ExtractedTextBlock[];
  rawMetadata: Record<string, unknown>;
  extractionMethod: 'configured-transcript-adapter' | 'operator-transcript-file';
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeVideoId(input: string): string {
  const url = new URL(input);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let id: string | null = null;
  if (host === 'youtube.com' && url.pathname === '/watch') id = url.searchParams.get('v');
  else if (host === 'youtu.be' && /^\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname)) id = url.pathname.split('/')[1];
  if (!id || !VIDEO_ID.test(id)) throw new Error('source must use a canonical YouTube watch or youtu.be video URL');
  return id;
}

function transcriptBlocks(transcript: string): ExtractedTextBlock[] {
  return transcript.normalize('NFKC').replace(/\r\n/g, '\n').split(/\n\s*\n/).map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean).map((text) => ({ kind: 'paragraph', text }));
}

export async function extractYouTubeTranscript(input: string, options: { adapter?: TranscriptAdapter; transcriptText?: string } = {}): Promise<YouTubeExtraction> {
  const videoId = parseYouTubeVideoId(input);
  if (!options.adapter && options.transcriptText === undefined) throw new Error('YouTube extraction requires a configured transcript adapter or operator transcript file');
  let result: TranscriptAdapterResult;
  let extractionMethod: YouTubeExtraction['extractionMethod'];
  if (options.transcriptText !== undefined) {
    result = { transcript: options.transcriptText };
    extractionMethod = 'operator-transcript-file';
  } else {
    try { result = await options.adapter!(videoId); }
    catch (error) { throw new Error(`transcript adapter failed; preserve this candidate for resume: ${error instanceof Error ? error.message : 'unknown error'}`); }
    extractionMethod = 'configured-transcript-adapter';
  }
  const blocks = transcriptBlocks(result.transcript);
  if (!blocks.length) throw new Error('transcript extraction produced no text; candidate remains resumable');
  return {
    videoId, title: result.title?.normalize('NFKC').trim() || `YouTube ${videoId}`,
    sourceName: result.channel?.normalize('NFKC').trim(), publicationDate: result.publicationDate,
    language: result.language, durationSeconds: result.durationSeconds,
    fullText: blocks.map((block) => block.text).join('\n\n'), blocks,
    rawMetadata: { videoId, ...result.rawMetadata }, extractionMethod,
  };
}
