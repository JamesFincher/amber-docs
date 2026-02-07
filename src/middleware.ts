import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function unauthorizedResponse() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Amber Docs Admin"' },
  });
}

function parseBasicAuth(header: string): { username: string; password: string } | null {
  const [scheme, encoded] = header.split(" ", 2);
  if (scheme?.toLowerCase() !== "basic" || !encoded) return null;

  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return null;
  }

  const i = decoded.indexOf(":");
  if (i < 0) return null;
  return { username: decoded.slice(0, i), password: decoded.slice(i + 1) };
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (!isAdminRoute) return NextResponse.next();

  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  // If not configured, don't block local dev; configure these in production.
  if (!expectedUsername || !expectedPassword) return NextResponse.next();

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return unauthorizedResponse();

  const parsed = parseBasicAuth(authHeader);
  if (!parsed) return unauthorizedResponse();

  if (parsed.username !== expectedUsername || parsed.password !== expectedPassword) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

