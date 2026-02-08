import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { createSlugger } from "@/lib/slugger";
import type { ReactNode } from "react";

export function Markdown({ value }: { value: string }) {
  const slugger = createSlugger();
  const schema = {
    ...defaultSchema,
    attributes: {
      ...(defaultSchema.attributes ?? {}),
      h1: [...((defaultSchema.attributes?.h1 as string[]) ?? []), "id"],
      h2: [...((defaultSchema.attributes?.h2 as string[]) ?? []), "id"],
      h3: [...((defaultSchema.attributes?.h3 as string[]) ?? []), "id"],
      h4: [...((defaultSchema.attributes?.h4 as string[]) ?? []), "id"],
      h5: [...((defaultSchema.attributes?.h5 as string[]) ?? []), "id"],
      h6: [...((defaultSchema.attributes?.h6 as string[]) ?? []), "id"],
      a: [...((defaultSchema.attributes?.a as string[]) ?? []), "aria-label"],
    },
  };

  function textFromChildren(children: ReactNode): string {
    if (children === null || children === undefined) return "";
    if (typeof children === "string" || typeof children === "number") return String(children);
    if (Array.isArray(children)) return children.map(textFromChildren).join("");
    if (typeof children === "object" && "props" in (children as object)) {
      const anyChild = children as { props?: { children?: ReactNode } };
      return textFromChildren(anyChild.props?.children);
    }
    return "";
  }

  return (
    <div className="prose prose-zinc max-w-none prose-headings:scroll-mt-24 prose-a:text-zinc-900 prose-a:decoration-zinc-400 hover:prose-a:decoration-zinc-900 prose-pre:rounded-lg prose-pre:border prose-pre:border-black/10 prose-pre:bg-zinc-950 prose-pre:text-zinc-50 prose-code:rounded prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.9em] prose-code:text-zinc-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={{
          h2({ children, ...props }) {
            const text = textFromChildren(children);
            const id = slugger.slug(text);
            return (
              <h2 id={id} {...props} className={`group ${props.className ?? ""}`.trim()}>
                {children}{" "}
                <a
                  href={`#${id}`}
                  aria-label={`Permalink: ${text}`}
                  className="ml-2 no-underline opacity-0 transition hover:opacity-100 group-hover:opacity-100"
                >
                  #
                </a>
              </h2>
            );
          },
          h3({ children, ...props }) {
            const text = textFromChildren(children);
            const id = slugger.slug(text);
            return (
              <h3 id={id} {...props} className={`group ${props.className ?? ""}`.trim()}>
                {children}{" "}
                <a
                  href={`#${id}`}
                  aria-label={`Permalink: ${text}`}
                  className="ml-2 no-underline opacity-0 transition hover:opacity-100 group-hover:opacity-100"
                >
                  #
                </a>
              </h3>
            );
          },
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
