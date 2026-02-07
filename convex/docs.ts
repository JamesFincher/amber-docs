import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function now() {
  return Date.now();
}

function required<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("docs").collect();
    docs.sort((a, b) => b.updatedAt - a.updatedAt);
    return docs.map((d) => ({
      _id: d._id,
      slug: d.slug,
      title: d.title,
      updatedAt: d.updatedAt,
      archived: d.archived ?? false,
      draftRevisionId: d.draftRevisionId ?? null,
      finalRevisionId: d.finalRevisionId ?? null,
      officialRevisionId: d.officialRevisionId ?? null,
    }));
  },
});

export const listOfficial = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("docs").collect();
    const official = docs.filter((d) => !!d.officialRevisionId && !(d.archived ?? false));
    official.sort((a, b) => b.updatedAt - a.updatedAt);

    const out = [];
    for (const d of official) {
      const officialRev = d.officialRevisionId ? await ctx.db.get(d.officialRevisionId) : null;
      out.push({
        slug: d.slug,
        title: d.title,
        updatedAt: d.updatedAt,
        markdown: officialRev?.markdown ?? "",
        revisionNumber: officialRev?.number ?? null,
      });
    }
    return out;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("docs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!doc) return null;

    const [draft, final, official] = await Promise.all([
      doc.draftRevisionId ? ctx.db.get(doc.draftRevisionId) : null,
      doc.finalRevisionId ? ctx.db.get(doc.finalRevisionId) : null,
      doc.officialRevisionId ? ctx.db.get(doc.officialRevisionId) : null,
    ]);

    const revisions = await ctx.db
      .query("revisions")
      .withIndex("by_docId", (q) => q.eq("docId", doc._id))
      .collect();
    revisions.sort((a, b) => b.number - a.number);

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_docId_createdAt", (q) => q.eq("docId", doc._id))
      .collect();

    return {
      doc: {
        _id: doc._id,
        slug: doc.slug,
        title: doc.title,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        archived: doc.archived ?? false,
        draftRevisionId: doc.draftRevisionId ?? null,
        finalRevisionId: doc.finalRevisionId ?? null,
        officialRevisionId: doc.officialRevisionId ?? null,
      },
      draft,
      final,
      official,
      revisions: revisions.map((r) => ({
        _id: r._id,
        number: r.number,
        createdAt: r.createdAt,
        message: r.message ?? null,
      })),
      notes: notes.map((n) => ({
        _id: n._id,
        createdAt: n.createdAt,
        body: n.body,
        revisionId: n.revisionId ?? null,
        section: n.section ?? null,
      })),
    };
  },
});

export const getRevision = query({
  args: { revisionId: v.id("revisions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.revisionId);
  },
});

export const getOfficialBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("docs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!doc) return null;
    if (doc.archived ?? false) return null;
    if (!doc.officialRevisionId) return null;
    const rev = await ctx.db.get(doc.officialRevisionId);
    if (!rev) return null;
    return {
      slug: doc.slug,
      title: doc.title,
      updatedAt: doc.updatedAt,
      markdown: rev.markdown,
      revisionNumber: rev.number,
    };
  },
});

export const create = mutation({
  args: {
    slug: v.string(),
    title: v.string(),
    markdown: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("docs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new Error(`A doc with slug "${args.slug}" already exists.`);

    const t = now();
    const docId = await ctx.db.insert("docs", {
      slug: args.slug,
      title: args.title,
      createdAt: t,
      updatedAt: t,
      archived: false,
    });

    const revisionId = await ctx.db.insert("revisions", {
      docId,
      number: 1,
      createdAt: t,
      markdown: args.markdown ?? `# ${args.title}\n\n`,
      message: "Initial draft",
    });

    await ctx.db.patch(docId, { draftRevisionId: revisionId, updatedAt: t });
    return { docId, revisionId };
  },
});

export const saveDraft = mutation({
  args: {
    docId: v.id("docs"),
    markdown: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = required(await ctx.db.get(args.docId), "Doc not found.");
    if (doc.archived ?? false) throw new Error("This doc is archived.");

    const existingRevisions = await ctx.db
      .query("revisions")
      .withIndex("by_docId", (q) => q.eq("docId", args.docId))
      .collect();
    const maxNumber = existingRevisions.reduce((m, r) => Math.max(m, r.number), 0);

    const t = now();
    const revisionId = await ctx.db.insert("revisions", {
      docId: args.docId,
      number: maxNumber + 1,
      createdAt: t,
      markdown: args.markdown,
      message: args.message,
    });

    await ctx.db.patch(args.docId, { draftRevisionId: revisionId, updatedAt: t });
    return { revisionId, number: maxNumber + 1 };
  },
});

export const promoteToFinal = mutation({
  args: { docId: v.id("docs"), revisionId: v.id("revisions") },
  handler: async (ctx, args) => {
    const doc = required(await ctx.db.get(args.docId), "Doc not found.");
    if (doc.archived ?? false) throw new Error("This doc is archived.");
    const rev = required(await ctx.db.get(args.revisionId), "Revision not found.");
    if (rev.docId !== args.docId) throw new Error("Revision does not belong to this doc.");

    await ctx.db.patch(args.docId, { finalRevisionId: args.revisionId, updatedAt: now() });
    return { ok: true };
  },
});

export const promoteToOfficial = mutation({
  args: { docId: v.id("docs"), revisionId: v.id("revisions") },
  handler: async (ctx, args) => {
    const doc = required(await ctx.db.get(args.docId), "Doc not found.");
    if (doc.archived ?? false) throw new Error("This doc is archived.");
    const rev = required(await ctx.db.get(args.revisionId), "Revision not found.");
    if (rev.docId !== args.docId) throw new Error("Revision does not belong to this doc.");

    await ctx.db.patch(args.docId, { officialRevisionId: args.revisionId, updatedAt: now() });
    return { ok: true };
  },
});

export const archive = mutation({
  args: { docId: v.id("docs"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const doc = required(await ctx.db.get(args.docId), "Doc not found.");
    await ctx.db.patch(doc._id, { archived: args.archived, updatedAt: now() });
    return { ok: true };
  },
});

