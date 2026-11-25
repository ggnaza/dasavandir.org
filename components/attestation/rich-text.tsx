"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";

/**
 * Question / option / passage text: Markdown + KaTeX ($…$, $$…$$) + a small set of
 * inline HTML tags the source tests rely on for meaning (underlined words, italics,
 * sub/superscripts).
 *
 * Raw HTML is parsed, then sanitised to that allowlist BEFORE KaTeX runs, so any
 * other tag in imported content is dropped and can never execute. KaTeX's `trust`
 * option stays off.
 */
const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u", "sub", "sup", "mark"],
  attributes: {
    ...defaultSchema.attributes,
    // remark-math marks math as <code class="language-math math-inline|math-display">.
    code: [["className", /^language-./, "math-inline", "math-display"]],
  },
};

export function RichText({ text, className = "", inline = false }: { text: string; className?: string; inline?: boolean }) {
  return (
    <div className={`attestation-rich prose prose-sm max-w-none ${inline ? "[&>p]:inline [&>p]:m-0" : ""} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema], rehypeKatex]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
