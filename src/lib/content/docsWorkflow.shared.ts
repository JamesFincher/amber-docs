export function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/(^-|-$)/g, "");
}

export function suggestedDocFileName(slug: string, version: string): string {
  const base = safeFilePart(slug);
  const ver = safeFilePart(version);
  return ver ? `${base}--${ver}.md` : `${base}.md`;
}

export function resolveVersionAndUpdatedAt(args: {
  version?: string | null;
  updatedAt?: string | null;
  now?: Date;
}): { version: string; updatedAt: string } {
  let version = args.version ?? null;
  let updatedAt = args.updatedAt ?? null;
  if (!updatedAt && version && isIsoDate(version)) updatedAt = version;
  if (!updatedAt) updatedAt = isoDate(args.now ?? new Date());
  if (!version) version = updatedAt;
  return { version, updatedAt };
}

