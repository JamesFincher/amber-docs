import matter from "gray-matter";
import { safeFilePart, suggestedDocFileName } from "@/lib/content/docsWorkflow.shared";

type FsWritableStream = {
  write(data: string): Promise<void>;
  close(): Promise<void>;
};

type FsFileHandle = {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FsWritableStream>;
};

type FsDirectoryHandle = {
  kind: "directory";
  name: string;
  entries(): AsyncIterableIterator<[string, FsFileHandle | FsDirectoryHandle]>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>;
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FsDirectoryHandle>;
};

export const BACKUP_DIR_NAME = ".amber-ai-backups";

async function readHandleText(fileHandle: FsFileHandle): Promise<string> {
  const file = await fileHandle.getFile();
  return await file.text();
}

async function writeHandleText(fileHandle: FsFileHandle, text: string) {
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}

function randomSuffix(): string {
  const cryptoObj = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

function backupTimestamp(now = new Date()): string {
  // Use a filesystem-safe timestamp while keeping lexicographic sort = time sort.
  return safeFilePart(now.toISOString());
}

export function backupFileName(args: { now?: Date; docFileName?: string }): string {
  const ts = backupTimestamp(args.now);
  const rand = randomSuffix();
  const docPart = args.docFileName ? `--${safeFilePart(args.docFileName)}` : "";
  return `backup--${ts}--${rand}${docPart}.md`;
}

async function ensureBackupDir(root: FsDirectoryHandle, create: boolean): Promise<FsDirectoryHandle | null> {
  try {
    return await root.getDirectoryHandle(BACKUP_DIR_NAME, { create });
  } catch {
    return null;
  }
}

export async function createWorkspaceBackup(args: {
  root: FsDirectoryHandle;
  docFileName: string;
  text: string;
  now?: Date;
}): Promise<{ backupFileName: string }> {
  const dir = await ensureBackupDir(args.root, true);
  if (!dir) throw new Error("Could not create/open backups folder.");
  const name = backupFileName({ now: args.now, docFileName: args.docFileName });
  const handle = await dir.getFileHandle(name, { create: true });
  await writeHandleText(handle, args.text);
  return { backupFileName: name };
}

function parseBackupMeta(args: { fileName: string; text: string }): {
  createdAt: string;
  slug: string;
  version: string;
  title: string;
} | null {
  const createdAt = (() => {
    const parts = args.fileName.split("--");
    return parts[0] === "backup" && parts[1] ? String(parts[1]) : "";
  })();

  const parsed = matter(args.text);
  const fm = (parsed.data ?? {}) as Record<string, unknown>;
  const slug = typeof fm.slug === "string" ? fm.slug : "";
  const version = typeof fm.version === "string" ? fm.version : typeof fm.updatedAt === "string" ? fm.updatedAt : "";
  const title = typeof fm.title === "string" ? fm.title : "";
  if (!slug.trim() || !version.trim()) return null;
  return { createdAt, slug: slug.trim(), version: version.trim(), title: title.trim() || slug.trim() };
}

export async function listWorkspaceBackups(args: {
  root: FsDirectoryHandle;
  slug?: string | null;
  version?: string | null;
  limit?: number;
}): Promise<{ backups: Array<{ backupFileName: string; createdAt: string; slug: string; version: string; title: string }> }> {
  const dir = await ensureBackupDir(args.root, false);
  if (!dir) return { backups: [] };
  const limit = typeof args.limit === "number" && Number.isFinite(args.limit) ? Math.max(1, Math.min(200, args.limit)) : 30;

  const wantSlug = (args.slug ?? "").trim();
  const wantVersion = (args.version ?? "").trim();

  const all: Array<{ backupFileName: string; createdAt: string; slug: string; version: string; title: string }> = [];
  for await (const [name, handle] of dir.entries()) {
    if (!handle || (handle as FsFileHandle).kind !== "file") continue;
    if (!name.endsWith(".md") && !name.endsWith(".mdx")) continue;
    try {
      const text = await readHandleText(handle as FsFileHandle);
      const meta = parseBackupMeta({ fileName: name, text });
      if (!meta) continue;
      if (wantSlug && meta.slug !== wantSlug) continue;
      if (wantVersion && meta.version !== wantVersion) continue;
      all.push({ backupFileName: name, createdAt: meta.createdAt, slug: meta.slug, version: meta.version, title: meta.title });
    } catch {
      // ignore unreadable backup
    }
  }

  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.backupFileName.localeCompare(a.backupFileName));
  return { backups: all.slice(0, limit) };
}

export async function restoreWorkspaceBackup(args: {
  root: FsDirectoryHandle;
  backupFileName: string;
  confirm: boolean;
}): Promise<{ ok: boolean; fileName: string; slug: string; version: string }> {
  if (!args.confirm) throw new Error("Refusing to restore without confirm=true.");
  const dir = await ensureBackupDir(args.root, false);
  if (!dir) throw new Error("No backups folder found.");
  const backupHandle = await dir.getFileHandle(args.backupFileName);
  const text = await readHandleText(backupHandle);
  const meta = parseBackupMeta({ fileName: args.backupFileName, text });
  if (!meta) throw new Error("Backup file did not look like a valid doc backup (missing slug/version).");

  const fileName = suggestedDocFileName(meta.slug, meta.version);
  const target = await args.root.getFileHandle(fileName, { create: true });
  await writeHandleText(target, text);
  return { ok: true, fileName, slug: meta.slug, version: meta.version };
}
