import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function text(body: string, init?: ResponseInit) {
  return new Response(body, {
    status: init?.status ?? 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function unauthorized() {
  return text("Unauthorized", { status: 401 });
}

function readBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice("bearer ".length);
}

type RpcPayload = {
  method?: unknown;
  args?: unknown;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export const adminRpc = httpAction(async (ctx, request) => {
  const expectedSecret = process.env.DOCS_WRITE_SECRET;
  if (!expectedSecret) {
    return text("Missing DOCS_WRITE_SECRET env var", { status: 500 });
  }

  const token = readBearerToken(request);
  if (!token || token !== expectedSecret) return unauthorized();

  if (request.method !== "POST") return text("Method Not Allowed", { status: 405 });

  let payload: RpcPayload;
  try {
    payload = (await request.json()) as RpcPayload;
  } catch {
    return text("Invalid JSON", { status: 400 });
  }

  const method = asString(payload?.method);
  const args = asObject(payload?.args) ?? {};
  if (!method) return text("Missing method", { status: 400 });

  try {
    switch (method) {
      case "docs.list":
        return json(await ctx.runQuery(internal.docs.adminList, {}));
      case "docs.getBySlug": {
        const slug = asString(args.slug);
        if (!slug) return text("Missing slug", { status: 400 });
        return json(await ctx.runQuery(internal.docs.adminGetBySlug, { slug }));
      }
      case "docs.getRevision":
        {
          const revisionId = asString(args.revisionId) as Id<"revisions"> | null;
          if (!revisionId) return text("Missing revisionId", { status: 400 });
          return json(
            await ctx.runQuery(internal.docs.adminGetRevision, {
              revisionId,
            }),
          );
        }
      case "docs.create": {
        const slug = asString(args.slug);
        const title = asString(args.title);
        const markdown = args.markdown === undefined ? undefined : asString(args.markdown);
        if (!slug) return text("Missing slug", { status: 400 });
        if (!title) return text("Missing title", { status: 400 });
        if (markdown === null) return text("Invalid markdown", { status: 400 });
        return json(
          await ctx.runMutation(internal.docs.adminCreate, {
            slug,
            title,
            markdown: markdown ?? undefined,
          }),
        );
      }
      case "docs.saveDraft": {
        const docId = asString(args.docId) as Id<"docs"> | null;
        const markdown = asString(args.markdown);
        const message = args.message === undefined ? undefined : asString(args.message);
        if (!docId) return text("Missing docId", { status: 400 });
        if (!markdown) return text("Missing markdown", { status: 400 });
        if (message === null) return text("Invalid message", { status: 400 });
        return json(
          await ctx.runMutation(internal.docs.adminSaveDraft, {
            docId,
            markdown,
            message: message ?? undefined,
          }),
        );
      }
      case "docs.promoteToFinal": {
        const docId = asString(args.docId) as Id<"docs"> | null;
        const revisionId = asString(args.revisionId) as Id<"revisions"> | null;
        if (!docId) return text("Missing docId", { status: 400 });
        if (!revisionId) return text("Missing revisionId", { status: 400 });
        return json(
          await ctx.runMutation(internal.docs.adminPromoteToFinal, {
            docId,
            revisionId,
          }),
        );
      }
      case "docs.promoteToOfficial": {
        const docId = asString(args.docId) as Id<"docs"> | null;
        const revisionId = asString(args.revisionId) as Id<"revisions"> | null;
        if (!docId) return text("Missing docId", { status: 400 });
        if (!revisionId) return text("Missing revisionId", { status: 400 });
        return json(
          await ctx.runMutation(internal.docs.adminPromoteToOfficial, {
            docId,
            revisionId,
          }),
        );
      }
      case "docs.archive": {
        const docId = asString(args.docId) as Id<"docs"> | null;
        const archived = asBool(args.archived);
        if (!docId) return text("Missing docId", { status: 400 });
        if (archived === null) return text("Missing archived", { status: 400 });
        return json(
          await ctx.runMutation(internal.docs.adminArchive, {
            docId,
            archived,
          }),
        );
      }
      case "notes.listByDoc": {
        const docId = asString(args.docId) as Id<"docs"> | null;
        if (!docId) return text("Missing docId", { status: 400 });
        return json(await ctx.runQuery(internal.notes.adminListByDoc, { docId }));
      }
      case "notes.add": {
        const docId = asString(args.docId) as Id<"docs"> | null;
        const body = asString(args.body);
        const section = args.section === undefined ? undefined : asString(args.section);
        const revisionId =
          args.revisionId === undefined ? undefined : (asString(args.revisionId) as Id<"revisions"> | null);

        if (!docId) return text("Missing docId", { status: 400 });
        if (!body) return text("Missing body", { status: 400 });
        if (section === null) return text("Invalid section", { status: 400 });
        if (revisionId === null) return text("Invalid revisionId", { status: 400 });

        return json(
          await ctx.runMutation(internal.notes.adminAdd, {
            docId,
            body,
            revisionId,
            section: section ?? undefined,
          }),
        );
      }
      case "seed.ensure":
        return json(await ctx.runMutation(internal.seed.ensureSeedData, {}));
      default:
        return text(`Unknown method: ${method}`, { status: 400 });
    }
  } catch (err: unknown) {
    return json(
      {
        error: "Admin RPC failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
});
