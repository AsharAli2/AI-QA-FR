import ReactMarkdown from 'react-markdown';

// Renders LLM-authored text (run summaries, per-turn notes) as markdown.
// `inline` drops the wrapping <p> so short one-line notes can sit next to a
// label instead of forcing a block break. Links open in a new tab since they
// point off-app.
export default function Markdown({ children, className = '', inline = false }) {
  if (!children) return null;
  const Tag = inline ? 'span' : 'div';
  return (
    <Tag className={`md ${className}`}>
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          ...(inline ? { p: ({ node, ...props }) => <span {...props} /> } : {}),
        }}
      >
        {children}
      </ReactMarkdown>
    </Tag>
  );
}
