import type { TocItem } from "@/lib/markdown";

export function Toc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav className="card p-5" aria-label="Table of contents">
      <div className="font-display text-xl font-semibold">Jump to a section</div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className={item.depth === 3 ? "ml-4" : ""}>
            <a
              href={`#${item.id}`}
              className="font-semibold text-zinc-800 underline decoration-black/20 underline-offset-4 hover:text-zinc-950 hover:decoration-black/40"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-4 text-sm text-zinc-600">
        Tip: Use <span className="font-semibold">Ctrl</span>+<span className="font-semibold">F</span> (Windows) or{" "}
        <span className="font-semibold">Cmd</span>+<span className="font-semibold">F</span> (Mac) to find words on this page.
      </div>
    </nav>
  );
}
