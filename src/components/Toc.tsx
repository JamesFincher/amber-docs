import type { TocItem } from "@/lib/markdown";

export function Toc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav className="card p-5">
      <div className="font-display text-xl font-semibold">Jump to a section</div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className={item.depth === 3 ? "ml-4" : ""}>
            <a
              href={`#${item.id}`}
              className="text-zinc-800 underline decoration-black/20 underline-offset-4 hover:text-zinc-950 hover:decoration-black/40"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
