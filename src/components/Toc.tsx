import type { TocItem } from "@/lib/markdown";

export function Toc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav className="rounded-xl border border-zinc-200 bg-white/60 p-4 text-sm backdrop-blur">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">On this page</div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className={item.depth === 3 ? "ml-4" : ""}>
            <a
              href={`#${item.id}`}
              className="text-zinc-700 underline decoration-black/10 underline-offset-4 hover:text-zinc-900 hover:decoration-black/30"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

