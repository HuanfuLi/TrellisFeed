import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { normalizeMarkdownText } from '../lib/text-normalization';

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
        rehypePlugins={[rehypeKatex]}
      >
        {normalizeMarkdownText(children)}
      </ReactMarkdown>
    </div>
  );
}
