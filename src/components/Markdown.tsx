import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export function Markdown({ value }: { value: string }) {
  return (
    <div className="prose prose-zinc max-w-none prose-headings:scroll-mt-24 prose-a:text-zinc-900 prose-a:decoration-zinc-400 hover:prose-a:decoration-zinc-900 prose-pre:rounded-lg prose-pre:border prose-pre:border-black/10 prose-pre:bg-zinc-950 prose-pre:text-zinc-50 prose-code:rounded prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.9em] prose-code:text-zinc-900">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {value}
      </ReactMarkdown>
    </div>
  );
}

