import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom') as { JSDOM: new (html: string, options?: Record<string, unknown>) => { window: { document: Document; close(): void } } };
const { Readability } = require('@mozilla/readability') as { Readability: new (document: Document, options?: Record<string, unknown>) => { parse(): { title?: string; byline?: string; excerpt?: string; content?: string; textContent?: string; lang?: string } | null } };

export type TextBlockKind = 'heading' | 'paragraph' | 'list-item' | 'quote' | 'code';
export interface ExtractedTextBlock { kind: TextBlockKind; text: string }

export interface ArticleExtraction {
  title: string;
  author?: string;
  publicationDate?: string;
  excerpt?: string;
  language?: string;
  fullText: string;
  blocks: ExtractedTextBlock[];
  rawMetadata: Record<string, unknown>;
  extractionMethod: 'readability-inert';
}

const cleanText = (value: string | null | undefined): string => (value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();

function meta(document: Document, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const value = element?.getAttribute('content') ?? element?.getAttribute('datetime') ?? element?.textContent;
    if (cleanText(value)) return cleanText(value);
  }
  return undefined;
}

function inertDocument(document: Document): void {
  document.querySelectorAll('script,style,noscript,iframe,frame,object,embed,form,input,button,textarea,select,option,link,base,meta[http-equiv],svg,canvas,audio,video,source,picture,img').forEach((node) => node.remove());
  document.querySelectorAll('*').forEach((element) => {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.toLowerCase().startsWith('on') || ['href', 'src', 'srcset', 'action', 'formaction', 'style'].includes(attribute.name.toLowerCase())) element.removeAttribute(attribute.name);
    }
  });
}

function revealStreamedServerContent(document: Document): void {
  // React/Next.js can stream the rendered page into a hidden staging container
  // and move it into place with an inline script. Scripts are deliberately never
  // executed here, so expose only staging containers that contain the page's
  // semantic root. Ordinary hidden UI, menus, and promotional content stay hidden.
  for (const element of document.querySelectorAll('[hidden]')) {
    if (element.querySelector('main,article')) element.removeAttribute('hidden');
  }
}

function blocksFromContent(content: string, fallback: string): ExtractedTextBlock[] {
  const dom = new JSDOM(`<body>${content}</body>`, { url: 'https://inert.invalid/', runScripts: undefined, resources: undefined });
  try {
    inertDocument(dom.window.document);
    const blocks: ExtractedTextBlock[] = [];
    const kinds: Record<string, TextBlockKind> = { H1: 'heading', H2: 'heading', H3: 'heading', H4: 'heading', H5: 'heading', H6: 'heading', P: 'paragraph', LI: 'list-item', BLOCKQUOTE: 'quote', PRE: 'code' };
    for (const element of dom.window.document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre')) {
      const text = cleanText(element.textContent);
      if (text && !blocks.some((block) => block.text === text)) blocks.push({ kind: kinds[element.tagName] ?? 'paragraph', text });
    }
    return blocks.length ? blocks : cleanText(fallback).split(/\n{2,}/).filter(Boolean).map((text) => ({ kind: 'paragraph', text: cleanText(text) }));
  } finally { dom.window.close(); }
}

export function extractArticle(html: string, sourceUrl: string): ArticleExtraction {
  const dom = new JSDOM(html, { url: sourceUrl, contentType: 'text/html', runScripts: undefined, resources: undefined });
  try {
    const document = dom.window.document;
    const author = meta(document, ['meta[name="author"]', 'meta[property="article:author"]', '[rel="author"]']);
    const publicationDate = meta(document, ['meta[property="article:published_time"]', 'meta[name="date"]', 'time[datetime]']);
    const documentLanguage = cleanText(document.documentElement.lang) || undefined;
    revealStreamedServerContent(document);
    inertDocument(document);
    const article = new Readability(document, { keepClasses: false }).parse();
    if (!article) throw new Error('article extraction produced no readable content');
    const blocks = blocksFromContent(article.content ?? '', article.textContent ?? '');
    const fullText = blocks.map((block) => block.text).join('\n\n');
    if (!fullText) throw new Error('article extraction produced no readable text');
    return {
      title: cleanText(article.title) || cleanText(document.title) || new URL(sourceUrl).hostname,
      author: cleanText(article.byline) || author,
      publicationDate,
      excerpt: cleanText(article.excerpt) || fullText.slice(0, 280),
      language: cleanText(article.lang) || documentLanguage,
      fullText, blocks,
      rawMetadata: { sourceUrl, extraction: 'readability', byline: cleanText(article.byline) || author, publicationDate },
      extractionMethod: 'readability-inert',
    };
  } finally { dom.window.close(); }
}
