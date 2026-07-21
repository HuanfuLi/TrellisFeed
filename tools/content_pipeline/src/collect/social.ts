import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fetchCandidate, type FetchCandidateOptions, type RawCandidate } from './fetch-candidate.ts';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');

type CandidateFetcher = (url: string, options: FetchCandidateOptions) => Promise<RawCandidate>;
export interface SocialFetchOptions extends FetchCandidateOptions { fetcher?: CandidateFetcher }

const clean = (value: unknown): string => String(value ?? '').normalize('NFKC').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const comparisonKey = (value: unknown): string => clean(value).replace(/https?:\/\/\S+/gi, ' ').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();

function platform(input: string): 'x' | 'reddit' | undefined {
  const hostname = new URL(input).hostname.toLowerCase();
  if (['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(hostname)) return 'x';
  if (['reddit.com', 'www.reddit.com'].includes(hostname)) return 'reddit';
  return undefined;
}

export function isSocialUrl(input: string): boolean { return platform(input) !== undefined; }

function requireCollected(candidate: RawCandidate, label: string): string {
  if (candidate.status !== 'collected' || !candidate.rawBody) throw new Error(`${label} did not return collected content`);
  return candidate.rawBody;
}

function socialRaw(input: {
  sourceUrl: string;
  platform: 'x' | 'reddit';
  author?: string;
  title?: string;
  publicationDate?: string;
  text: string;
  collectedAt: string;
  collectorVersion: string;
  extractionMethod: string;
  verification?: Record<string, unknown>;
}): RawCandidate {
  const text = clean(input.text);
  if (!text) throw new Error('social post snapshot is empty');
  return {
    sourceUrl: input.sourceUrl,
    canonicalUrl: input.sourceUrl,
    platform: input.platform,
    sourceName: input.platform === 'x' ? 'X' : 'Reddit',
    author: clean(input.author) || undefined,
    title: clean(input.title) || undefined,
    publicationDate: input.publicationDate,
    collectedAt: input.collectedAt,
    collectorVersion: `${input.collectorVersion}+social-snapshot-v1`,
    sourceHash: createHash('sha256').update(text).digest('hex'),
    status: 'collected',
    mimeType: 'text/plain',
    rawBody: text,
    rawMetadata: {
      contentKind: 'social-post',
      platform: input.platform,
      extractionMethod: input.extractionMethod,
      ...(input.verification ?? {}),
    },
  };
}

async function fetchX(sourceUrl: string, fetcher: CandidateFetcher, options: FetchCandidateOptions): Promise<RawCandidate> {
  const source = new URL(sourceUrl);
  const statusId = source.pathname.match(/\/status\/(\d+)/)?.[1];
  if (!statusId) throw new Error('X source must be a direct status URL');
  const oembedUrl = `https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=${encodeURIComponent(sourceUrl)}`;
  const oembedRaw = await fetcher(oembedUrl, options);
  const oembed = JSON.parse(requireCollected(oembedRaw, 'X official oEmbed'));
  const dom = new JSDOM(oembed.html ?? '');
  let officialText = '';
  try {
    dom.window.document.querySelectorAll('blockquote p br').forEach((node: any) => node.replaceWith('\n'));
    officialText = clean(dom.window.document.querySelector('blockquote p')?.textContent);
  }
  finally { dom.window.close(); }
  if (!officialText) throw new Error('X official oEmbed returned no post text');

  let text = officialText.replace(/\s+pic\.twitter\.com\/\S+$/i, '').trim();
  let extractionMethod = 'x-official-oembed';
  let fullTextSnapshotSource: string | undefined;
  if (/…|\.\.\./.test(officialText)) {
    const mirrorRaw = await fetcher(`https://api.fxtwitter.com${source.pathname}`, options);
    const mirror = JSON.parse(requireCollected(mirrorRaw, 'X full-text mirror'));
    const mirrorText = clean(mirror?.tweet?.text);
    const officialPrefix = comparisonKey(officialText.replace(/(?:…|\.\.\.).*$/s, '')).slice(0, 80);
    if (!mirrorText || !officialPrefix || !comparisonKey(mirrorText).startsWith(officialPrefix)) throw new Error('X mirror text does not match official oEmbed prefix');
    text = mirrorText;
    extractionMethod = 'x-oembed-verified-fxtwitter-snapshot';
    fullTextSnapshotSource = 'api.fxtwitter.com';
  }
  const snowflakeDate = new Date(Number((BigInt(statusId) >> 22n) + 1288834974657n)).toISOString();
  return socialRaw({
    sourceUrl,
    platform: 'x',
    author: oembed.author_name,
    publicationDate: snowflakeDate,
    text,
    collectedAt: oembedRaw.collectedAt,
    collectorVersion: oembedRaw.collectorVersion,
    extractionMethod,
    verification: { officialOEmbedPrefixMatched: true, ...(fullTextSnapshotSource ? { fullTextSnapshotSource } : {}) },
  });
}

async function fetchReddit(sourceUrl: string, fetcher: CandidateFetcher, options: FetchCandidateOptions): Promise<RawCandidate> {
  const source = new URL(sourceUrl);
  if (!/\/comments\/[^/]+\//.test(source.pathname)) throw new Error('Reddit source must be a direct post URL');
  const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(sourceUrl)}`;
  const oembedRaw = await fetcher(oembedUrl, options);
  const oembed = JSON.parse(requireCollected(oembedRaw, 'Reddit official oEmbed'));
  const embedUrl = `https://www.redditmedia.com${source.pathname.replace(/\/?$/, '/')}?ref_source=embed&ref=share&embed=true`;
  const embedRaw = await fetcher(embedUrl, options);
  const dom = new JSDOM(requireCollected(embedRaw, 'Reddit official embed'));
  try {
    const title = clean(dom.window.document.querySelector('shreddit-embed-title')?.textContent ?? oembed.title);
    const text = clean(dom.window.document.querySelector('[id$="-post-rtjson-content"]')?.textContent);
    const author = clean(dom.window.document.querySelector('a[href*="/user/"]')?.textContent ?? oembed.author_name);
    const publicationDate = dom.window.document.querySelector('faceplate-timeago')?.getAttribute('ts') ?? undefined;
    if (!title || !text) throw new Error('Reddit official embed returned no complete OP');
    return socialRaw({
      sourceUrl,
      platform: 'reddit',
      author,
      title,
      publicationDate,
      text,
      collectedAt: embedRaw.collectedAt,
      collectorVersion: embedRaw.collectorVersion,
      extractionMethod: 'reddit-official-embed-op',
      verification: { repliesStored: false, repliesRequireCanonicalUrl: true },
    });
  } finally { dom.window.close(); }
}

export async function fetchSocialCandidate(sourceUrl: string, options: SocialFetchOptions = {}): Promise<RawCandidate> {
  const sourcePlatform = platform(sourceUrl);
  if (!sourcePlatform) throw new Error('unsupported social source URL');
  const fetcher = options.fetcher ?? fetchCandidate;
  const { fetcher: _fetcher, ...fetchOptions } = options;
  return sourcePlatform === 'x'
    ? fetchX(sourceUrl, fetcher, fetchOptions)
    : fetchReddit(sourceUrl, fetcher, fetchOptions);
}
