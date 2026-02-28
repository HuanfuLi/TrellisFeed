import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
