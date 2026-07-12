export type QualitySignalLevel = 'pass' | 'warn' | 'fail';

export interface QualitySignal {
  code: string;
  level: QualitySignalLevel;
  detail: string;
}

export interface QualityCandidate {
  id: string;
  canonicalUrl: string;
  fullText: string;
  language?: string;
  publicationDate?: string;
  evergreen?: boolean;
  videoUrlReady?: boolean;
  sourceShare?: number;
  stanceShare?: number;
}

export interface QualityOptions {
  topicKeywords: string[];
  expectedLanguage?: string;
  isVideo?: boolean;
  now?: Date;
  minimumCharacters?: number;
  staleAfterYears?: number;
}

export interface QualityVerdict {
  candidateId: string;
  disposition: 'reject' | 'review-priority' | 'review';
  score: number;
  signals: QualitySignal[];
  requiresHumanReview: true;
}

const normalized = (value: string): string => value.normalize('NFKC').toLocaleLowerCase('en-US').replace(/\s+/g, ' ').trim();

function unstableUrl(input: string): boolean {
  const url = new URL(input);
  return /\/(login|signin|auth|account)(?:\/|$)/i.test(url.pathname)
    || [...url.searchParams.keys()].some((key) => /^(session|token|auth|next|redirect)$/i.test(key));
}

function signal(code: string, level: QualitySignalLevel, detail: string): QualitySignal {
  return { code, level, detail };
}

export function scoreMechanicalQuality(candidate: QualityCandidate, options: QualityOptions): QualityVerdict {
  const minimumCharacters = options.minimumCharacters ?? 400;
  const staleAfterYears = options.staleAfterYears ?? 5;
  const now = options.now ?? new Date();
  const fullText = normalized(candidate.fullText);
  const expectedLanguage = normalized(options.expectedLanguage ?? 'en');
  const candidateLanguage = normalized(candidate.language ?? '');
  const keywords = [...new Set(options.topicKeywords.map(normalized).filter(Boolean))].sort();
  const matchedKeywords = keywords.filter((keyword) => fullText.includes(keyword));
  const signals: QualitySignal[] = [];

  if (options.isVideo && candidate.videoUrlReady === true) signals.push(signal('video-url-ready', 'pass', 'Canonical public YouTube URL is ready for Gemini preprocessing.'));
  else if (!fullText) signals.push(signal('extraction-missing', 'fail', 'No extracted text is available.'));
  else if (fullText.length < minimumCharacters) signals.push(signal('extraction-too-short', 'fail', `Extracted text has ${fullText.length} characters; minimum is ${minimumCharacters}.`));
  else signals.push(signal('extraction-length-ok', 'pass', `Extracted text has ${fullText.length} characters.`));

  if (unstableUrl(candidate.canonicalUrl)) signals.push(signal('unstable-url', 'fail', 'URL appears to require login, session, or redirect state.'));
  if (candidateLanguage && candidateLanguage !== expectedLanguage) signals.push(signal('language-mismatch', 'fail', `Expected ${expectedLanguage}; found ${candidateLanguage}.`));

  if (options.isVideo && candidate.videoUrlReady !== true) signals.push(signal('video-url-missing', 'fail', 'Video has no validated canonical public YouTube URL.'));

  if (options.isVideo && candidate.videoUrlReady === true) signals.push(signal('topic-review-after-video-understanding', 'warn', 'Topic relevance is evaluated from the generated video digest.'));
  else if (!keywords.length || matchedKeywords.length) signals.push(signal('topic-relevant', 'pass', matchedKeywords.length ? `Matched: ${matchedKeywords.join(', ')}.` : 'No topic keywords configured.'));
  else signals.push(signal('topic-irrelevant', 'fail', 'No configured topic keyword appears in extracted text.'));

  if (candidate.evergreen) signals.push(signal('evergreen', 'pass', 'Operator seed marks this source as evergreen.'));
  else if (candidate.publicationDate) {
    const published = new Date(candidate.publicationDate);
    const cutoff = new Date(now);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - staleAfterYears);
    if (!Number.isNaN(published.valueOf()) && published < cutoff) signals.push(signal('dated', 'warn', `Publication predates the ${staleAfterYears}-year review window.`));
  } else signals.push(signal('date-missing', 'warn', 'Publication date is unavailable.'));

  if (/\b(buy|sale|discount|sponsored|limited time|subscribe now)\b/i.test(fullText)) signals.push(signal('promotional-language', 'warn', 'Promotional language requires reviewer attention.'));
  if ((candidate.sourceShare ?? 0) > 0.5) signals.push(signal('source-concentration', 'warn', 'Source share exceeds 50% of the supplied review set.'));
  if ((candidate.stanceShare ?? 0) > 0.65) signals.push(signal('stance-concentration', 'warn', 'Stance share exceeds 65% of the supplied review set.'));

  const failures = signals.filter((item) => item.level === 'fail').length;
  const warnings = signals.filter((item) => item.level === 'warn').length;
  return {
    candidateId: candidate.id,
    disposition: failures ? 'reject' : warnings ? 'review-priority' : 'review',
    score: Math.max(0, 100 - failures * 30 - warnings * 8),
    signals,
    requiresHumanReview: true,
  };
}
