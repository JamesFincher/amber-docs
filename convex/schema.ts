import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  docs: defineTable({
    slug: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),

    // Pointer-style workflow: draft -> final -> official.
    draftRevisionId: v.optional(v.id("revisions")),
    finalRevisionId: v.optional(v.id("revisions")),
    officialRevisionId: v.optional(v.id("revisions")),

    archived: v.optional(v.boolean()),
  })
    .index("by_slug", ["slug"])
    .index("by_updatedAt", ["updatedAt"]),

  revisions: defineTable({
    docId: v.id("docs"),
    number: v.number(),
    createdAt: v.number(),
    markdown: v.string(),
    message: v.optional(v.string()),
  })
    .index("by_docId", ["docId"])
    .index("by_docId_number", ["docId", "number"]),

  notes: defineTable({
    docId: v.id("docs"),
    revisionId: v.optional(v.id("revisions")),
    section: v.optional(v.string()),
    body: v.string(),
    createdAt: v.number(),
  })
    .index("by_docId", ["docId"])
    .index("by_docId_createdAt", ["docId", "createdAt"]),
});

