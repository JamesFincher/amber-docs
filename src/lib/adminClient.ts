"use client";

type RpcRequest = {
  method: string;
  args?: Record<string, unknown>;
};

export async function adminRpc<T = unknown>(method: string, args?: RpcRequest["args"]) {
  throw new Error(
    "adminRpc is not available in static export builds. Remove this call or switch off `output: export`.",
  );

  const res = await fetch("/api/admin/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, args } satisfies RpcRequest),
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : (payload?.message as string | undefined) ?? JSON.stringify(payload);
    throw new Error(message);
  }

  return payload as T;
}
