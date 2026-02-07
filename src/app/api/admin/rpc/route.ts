import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!siteUrl) {
    return NextResponse.json(
      { message: "Missing NEXT_PUBLIC_CONVEX_SITE_URL. Did you run `pnpm convex dev`?" },
      { status: 500 },
    );
  }

  const secret = process.env.DOCS_WRITE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { message: "Missing DOCS_WRITE_SECRET. Set it in your web host env vars." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const upstream = await fetch(`${siteUrl}/admin/rpc`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });

  const contentType = upstream.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await upstream.json()) as unknown)
    : await upstream.text();

  if (!upstream.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : typeof payload === "object" && payload !== null && "message" in payload
          ? String((payload as { message: unknown }).message)
          : "Admin RPC failed";

    return NextResponse.json(
      {
        message,
        upstreamStatus: upstream.status,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(payload);
}
