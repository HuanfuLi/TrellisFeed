import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import 'katex/dist/katex.min.css';
import { normalizeMarkdownText } from '../lib/text-normalization';

// Allow <sup> for citation tags while blocking dangerous elements.
// Extend the default GitHub schema with our citation attributes.
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'sup'],
  attributes: {
    ...defaultSchema.attributes,
    // Phase 41 SC-5(c) / RESEARCH Pitfall 4 — spread defaultSchema sup attrs so
    // future schema additions (e.g. data-footnotes, aria-describedby) survive.
    // Mirrors the span/div pattern below; previously we REPLACED the default sup
    // attribute list, which would have stripped any new default-allowed attrs.
    sup: [...(defaultSchema.attributes?.['sup'] ?? []), 'dataCite', 'style'],
    // KaTeX injects spans/divs with class and style — allow those through
    span: [...(defaultSchema.attributes?.['span'] ?? []), 'className', 'style'],
    div: [...(defaultSchema.attributes?.['div'] ?? []), 'className', 'style'],
  },
};

// Phase 41 SC-5(b) — citation chip + footnote link + footnote section overrides.
// Targets remark-gfm v4's footnote output shape:
//   <sup><a href="#user-content-fn-1" id="user-content-fnref-1"
//          data-footnote-ref aria-describedby="footnote-label">N</a></sup>
//   <section data-footnotes class="footnotes">...</section>
// The LLM emits markdown footnote syntax ([^N] markers + [^N]: section per
// generateNewsEssay's prompt); remark-gfm parses it; we style it here.
const citationComponents: Components = {
  sup: ({ children, ...rest }) => (
    <sup
      {...rest}
      style={{
        fontSize: '0.7em',
        padding: '1px 4px',
        borderRadius: '4px',
        background: 'var(--surface-variant)',
        color: 'var(--muted-foreground)',
        margin: '0 1px',
        verticalAlign: 'super',
      }}
    >
      {children}
    </sup>
  ),
  a: ({ href, children, ...rest }) => {
    // Discriminate footnote refs/backrefs by data attribute — survives
    // hast-util-sanitize DOM-clobber prefix changes (e.g. user-content-fn-N).
    const restRecord = rest as Record<string, unknown>;
    const isFootnoteRef = restRecord['data-footnote-ref'];
    const isFootnoteBackref = restRecord['data-footnote-backref'];
    if (isFootnoteRef || isFootnoteBackref) {
      return (
        <a
          {...rest}
          href={href}
          style={{ color: 'var(--primary-40)', textDecoration: 'none' }}
        >
          {children}
        </a>
      );
    }
    return <a {...rest} href={href}>{children}</a>;
  },
  section: ({ children, className, ...rest }) => {
    if (className?.includes('footnotes')) {
      return (
        <section
          {...rest}
          className={className}
          style={{
            marginTop: '24px',
            paddingTop: '12px',
            borderTop: '1px solid var(--surface-variant)',
            fontSize: '0.85em',
            color: 'var(--muted-foreground)',
          }}
        >
          {children}
        </section>
      );
    }
    return <section {...rest} className={className}>{children}</section>;
  },
};

interface MarkdownProps {
  children: string;
}

/**
 * Renders markdown content with scoped prose styles.
 * Used in AI chat bubbles and script preview text.
 */
export function Markdown({ children }: MarkdownProps) {
  return (
    <div className="md-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
        components={citationComponents}
      >
        {normalizeMarkdownText(children)}
      </ReactMarkdown>
    </div>
  );
}
