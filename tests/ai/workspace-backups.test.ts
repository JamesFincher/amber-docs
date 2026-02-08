import { describe, expect, test } from "vitest";

type Entry = FakeFileHandle | FakeDirHandle;

class FakeWritable {
  constructor(private onClose: (text: string) => void) {}
  private buf = "";
  async write(data: string) {
    this.buf += data;
  }
  async close() {
    this.onClose(this.buf);
  }
}

class FakeFileHandle {
  kind = "file" as const;
  constructor(
    public name: string,
    private textValue: string,
  ) {}

  async getFile(): Promise<File> {
    return new File([this.textValue], this.name, { type: "text/markdown" });
  }

  async createWritable() {
    return new FakeWritable((t) => {
      this.textValue = t;
    });
  }

  get text() {
    return this.textValue;
  }
}

class FakeDirHandle {
  kind = "directory" as const;
  private items = new Map<string, Entry>();
  constructor(public name: string) {}

  async *entries(): AsyncIterableIterator<[string, Entry]> {
    for (const [k, v] of this.items.entries()) yield [k, v];
  }

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<FakeFileHandle> {
    const existing = this.items.get(name);
    if (existing && existing.kind === "file") return existing as FakeFileHandle;
    if (existing && existing.kind === "directory") throw new Error("Not a file");
    if (!opts?.create) throw new Error("Not found");
    const fh = new FakeFileHandle(name, "");
    this.items.set(name, fh);
    return fh;
  }

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FakeDirHandle> {
    const existing = this.items.get(name);
    if (existing && existing.kind === "directory") return existing as FakeDirHandle;
    if (existing && existing.kind === "file") throw new Error("Not a directory");
    if (!opts?.create) throw new Error("Not found");
    const dh = new FakeDirHandle(name);
    this.items.set(name, dh);
    return dh;
  }
}

describe("workspaceBackups", () => {
  test("createWorkspaceBackup writes a backup file and listWorkspaceBackups can find it", async () => {
    const { BACKUP_DIR_NAME, createWorkspaceBackup, listWorkspaceBackups } = await import("../../src/lib/ai/workspaceBackups");

    const root = new FakeDirHandle("docs");
    // A valid doc file text (frontmatter must include slug/version).
    const docText = `---\nslug: a\nversion: \"2026-02-08\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-02-08\"\n---\n\n# A\n`;

    const r = await createWorkspaceBackup({ root, docFileName: "a--2026-02-08.md", text: docText, now: new Date("2026-02-08T12:00:00.000Z") });
    expect(r.backupFileName).toMatch(/backup--/);

    const backupDir = await root.getDirectoryHandle(BACKUP_DIR_NAME);
    const backupHandle = await backupDir.getFileHandle(r.backupFileName);
    expect(backupHandle.text).toContain("slug: a");

    const listed = await listWorkspaceBackups({ root, slug: "a", version: "2026-02-08", limit: 10 });
    expect(listed.backups.length).toBe(1);
    expect(listed.backups[0]?.backupFileName).toBe(r.backupFileName);
  });

  test("restoreWorkspaceBackup recreates the doc file", async () => {
    const { BACKUP_DIR_NAME, createWorkspaceBackup, restoreWorkspaceBackup } = await import("../../src/lib/ai/workspaceBackups");

    const root = new FakeDirHandle("docs");
    const docText = `---\nslug: a\nversion: \"2026-02-08\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-02-08\"\n---\n\n# A\n`;

    const r = await createWorkspaceBackup({ root, docFileName: "a--2026-02-08.md", text: docText, now: new Date("2026-02-08T12:00:00.000Z") });

    // Simulate the doc not existing anymore.
    await root.getFileHandle("a--2026-02-08.md", { create: true }); // create empty then overwrite via restore
    const docHandle = await root.getFileHandle("a--2026-02-08.md");
    expect(docHandle.text).toBe("");

    const restored = await restoreWorkspaceBackup({ root, backupFileName: r.backupFileName, confirm: true });
    expect(restored.ok).toBe(true);
    expect(restored.fileName).toBe("a--2026-02-08.md");

    const backupDir = await root.getDirectoryHandle(BACKUP_DIR_NAME);
    expect(await backupDir.getFileHandle(r.backupFileName)).toBeTruthy();
    expect((await root.getFileHandle("a--2026-02-08.md")).text).toContain("# A");
  });

  test("restoreWorkspaceBackup refuses without confirm=true", async () => {
    const { createWorkspaceBackup, restoreWorkspaceBackup } = await import("../../src/lib/ai/workspaceBackups");
    const root = new FakeDirHandle("docs");
    const docText = `---\nslug: a\nversion: \"2026-02-08\"\ntitle: A\nstage: draft\nsummary: s\nupdatedAt: \"2026-02-08\"\n---\n\n# A\n`;
    const r = await createWorkspaceBackup({ root, docFileName: "a--2026-02-08.md", text: docText });
    await expect(restoreWorkspaceBackup({ root, backupFileName: r.backupFileName, confirm: false })).rejects.toThrow(/confirm/i);
  });
});
