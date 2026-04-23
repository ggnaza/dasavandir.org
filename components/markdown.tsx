import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-3">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xl font-semibold mt-5 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
        p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-brand-300 pl-4 my-3 text-gray-600 italic">
            {children}
          </blockquote>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          return isBlock ? (
            <pre className="bg-gray-100 rounded-lg p-4 my-3 overflow-x-auto text-sm font-mono">
              <code>{children}</code>
            </pre>
          ) : (
            <code className="bg-gray-100 rounded px-1.5 py-0.5 text-sm font-mono">{children}</code>
          );
        },
        hr: () => <hr className="my-5 border-gray-200" />,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full border border-gray-200 rounded-lg text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="bg-gray-50 px-4 py-2 text-left font-semibold border-b">{children}</th>,
        td: ({ children }) => <td className="px-4 py-2 border-b border-gray-100">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
