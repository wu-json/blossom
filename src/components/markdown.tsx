import ReactMarkdown from "react-markdown";

interface MarkdownProps {
  content: string;
}

export function Markdown({ content }: MarkdownProps) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc ml-4 mb-2 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        code: ({ className, children }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block text-[13px] font-mono">{children}</code>
            );
          }
          return (
            <code className="bg-white/10 px-1.5 py-0.5 rounded text-[13px] font-mono">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-white/10 p-3 rounded-lg my-2 last:mb-0 overflow-x-auto text-[13px]">
            {children}
          </pre>
        ),
        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold mb-1">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-white/30 pl-3 my-2 opacity-80">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-white/20 my-3" />,
        a: ({ href, children }) => (
          <a href={href} className="underline hover:opacity-80" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
