"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { DocRecord } from "@/lib/docs";
import { stageBadgeClass } from "@/lib/docs";

const LATEST = "__latest__";

export function VersionSelector(props: {
  slug: string;
  version: string;
  versions: DocRecord[];
  isLatest: boolean;
}) {
  const router = useRouter();
  const latestVersion = props.versions[0]?.version ?? props.version;

  const value = props.isLatest ? LATEST : props.version;

  const options = useMemo(() => {
    const out: Array<{ value: string; label: string; stage: DocRecord["stage"] | null }> = [];
    out.push({ value: LATEST, label: `Latest (v${latestVersion})`, stage: null });
    for (const v of props.versions) {
      out.push({
        value: v.version,
        label: `v${v.version} · ${v.updatedAt}`,
        stage: v.stage,
      });
    }
    return out;
  }, [props.versions, latestVersion]);

  return (
    <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/70 px-3 py-2 text-xs font-medium text-zinc-700 backdrop-blur">
      <span className="text-zinc-500">Version</span>
      <select
        className="bg-transparent text-xs font-semibold text-zinc-900 outline-none"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          if (next === LATEST) router.push(`/docs/${encodeURIComponent(props.slug)}`);
          else router.push(`/docs/${encodeURIComponent(props.slug)}/v/${encodeURIComponent(next)}`);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {props.isLatest ? null : (
        <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${stageBadgeClass(props.versions.find((v) => v.version === props.version)?.stage ?? "draft")}`}>
          {props.versions.find((v) => v.version === props.version)?.stage ?? "draft"}
        </span>
      )}
    </label>
  );
}

