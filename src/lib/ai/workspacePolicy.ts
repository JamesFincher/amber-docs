import type { Approval, DocStage } from "@/lib/docs";
import { isoDate } from "@/lib/content/docsWorkflow.shared";

export type WorkspaceMode = "read" | "readwrite";

export type WorkspaceStatus = {
  connected: boolean;
  mode: WorkspaceMode;
  allowFileWrites: boolean;
  allowDeletes: boolean;
  writeReady: boolean;
  docsCount: number;
};

export function computeWriteReady(args: {
  connected: boolean;
  mode: WorkspaceMode;
  allowFileWrites: boolean;
}): boolean {
  return args.connected && args.allowFileWrites && args.mode === "readwrite";
}

export function stagePatch(stage: DocStage, opts?: { reviewedAt?: string | null; now?: Date }): Record<string, unknown> {
  if (stage === "official") {
    const reviewedAt = (opts?.reviewedAt ?? "").trim();
    return { stage, lastReviewedAt: reviewedAt || isoDate(opts?.now ?? new Date()) };
  }
  // Only Official docs should have a review date.
  return { stage, lastReviewedAt: undefined };
}

export function officialPatch(opts?: {
  reviewedAt?: string | null;
  approvals?: Approval[] | null;
  includeApprovals?: boolean;
  now?: Date;
}): Record<string, unknown> {
  const base = stagePatch("official", { reviewedAt: opts?.reviewedAt, now: opts?.now });
  if (opts?.includeApprovals) {
    return { ...base, approvals: opts?.approvals ?? [] };
  }
  return base;
}

export function deletePolicy(args: {
  writeReady: boolean;
  allowDeletes: boolean;
  confirm: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!args.writeReady) {
    return {
      ok: false,
      reason: "Workspace is not write-ready (connect a folder with read/write access and enable Allow file edits).",
    };
  }
  if (!args.allowDeletes) {
    return {
      ok: false,
      reason: "Deletes are disabled. Open Advanced settings and turn on Allow deletes (danger).",
    };
  }
  if (!args.confirm) {
    return {
      ok: false,
      reason: "Refusing to delete without confirm=true. This action is permanent.",
    };
  }
  return { ok: true };
}

