"use client";

import { useEffect, useState } from "react";

const BOOKMARKS_KEY = "amber-docs:bookmarks:v1";

function readBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === "string") as string[]);
  } catch {
    return new Set();
  }
}

function writeBookmarks(bm: Set<string>) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(Array.from(bm.values()).sort()));
}

export function BookmarkButton({ slug }: { slug: string }) {
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    setBookmarked(readBookmarks().has(slug));
  }, [slug]);

  return (
    <button
      type="button"
      className={bookmarked ? "btn btn-primary" : "btn btn-secondary"}
      onClick={() => {
        const bm = readBookmarks();
        if (bm.has(slug)) bm.delete(slug);
        else bm.add(slug);
        writeBookmarks(bm);
        setBookmarked(bm.has(slug));
      }}
    >
      {bookmarked ? "Bookmarked" : "Bookmark"}
    </button>
  );
}

