export function LessonHtmlRenderer({ content }: { content: string }) {
  return (
    <div
      className="prose prose-sm max-w-none text-gray-800
        prose-headings:font-bold prose-headings:text-gray-900
        prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
        prose-p:leading-relaxed prose-p:mb-3
        prose-ul:pl-5 prose-ol:pl-5
        prose-li:mb-1
        prose-blockquote:border-l-4 prose-blockquote:border-brand-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
        prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:text-sm prose-code:font-mono
        prose-pre:bg-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
        prose-a:text-brand-600 prose-a:underline
        prose-hr:border-gray-200"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
