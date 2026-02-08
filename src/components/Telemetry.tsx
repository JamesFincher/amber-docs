"use client";

import { useEffect } from "react";

function post(url: string, payload: unknown) {
  try {
    const body = JSON.stringify(payload);
    // Prefer sendBeacon for unload-safety; fall back to fetch.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return Promise.resolve();
    }
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

export function Telemetry() {
  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_ERROR_REPORT_URL;
    if (!endpoint) return;
    const url = endpoint;

    function onError(ev: ErrorEvent) {
      void post(url, {
        kind: "error",
        message: ev.message,
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
        stack: ev.error instanceof Error ? ev.error.stack : null,
        url: window.location.href,
        ts: Date.now(),
      });
    }

    function onRejection(ev: PromiseRejectionEvent) {
      const reason = ev.reason;
      void post(url, {
        kind: "unhandledrejection",
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : null,
        url: window.location.href,
        ts: Date.now(),
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
