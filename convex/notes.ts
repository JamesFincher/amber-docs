import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByDoc = query({
  args: { docId: v.id("docs") },
  handler: async (ctx, args) => {
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_docId_createdAt", (q) => q.eq("docId", args.docId))
      .collect();
    return notes.map((n) => ({
      _id: n._id,
      createdAt: n.createdAt,
      body: n.body,
      revisionId: n.revisionId ?? null,
      section: n.section ?? null,
    }));
  },
});

export const add = mutation({
  args: {
    docId: v.id("docs"),
    body: v.string(),
    revisionId: v.optional(v.id("revisions")),
    section: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.docId);
    if (!doc) throw new Error("Doc not found.");
    if (doc.archived ?? false) throw new Error("This doc is archived.");

    if (args.revisionId) {
      const rev = await ctx.db.get(args.revisionId);
      if (!rev) throw new Error("Revision not found.");
      if (rev.docId !== args.docId) throw new Error("Revision does not belong to this doc.");
    }

    const noteId = await ctx.db.insert("notes", {
      docId: args.docId,
      revisionId: args.revisionId,
      section: args.section,
      body: args.body,
      createdAt: Date.now(),
    });

    return { noteId };
  },
});

