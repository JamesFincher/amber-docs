import Link from "next/link";
import { docs } from "@/lib/docs";
import { DocsLibraryClient } from "./DocsLibraryClient";

export const metadata = {
  title: "Docs | Amber Protocol",
  description: "Browse draft, final, and official documentation",
};

export default function DocsIndexPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link href="/" className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40">
            Home
          </Link>
          <Link
            href="/templates"
            className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40"
          >
            Templates
          </Link>
        </nav>
        <h1 className="text-3xl font-semibold">Documentation Library</h1>
        <p className="text-zinc-600">
          Browse docs by lifecycle stage and open each page for markdown content, AI checks, and linked
          context.
        </p>
      </header>

      <DocsLibraryClient docs={docs} />
    </main>
  );
}
