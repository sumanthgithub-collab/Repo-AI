"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RepoTalk Error]", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="card p-8 md:p-12 text-center max-w-md w-full">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "var(--error-muted)", border: "1px solid rgba(220,38,38,0.2)" }}
        >
          <AlertTriangle size={28} style={{ color: "var(--error)" }} />
        </div>

        <h1 className="text-xl font-semibold mb-2" style={{ fontSize: "1.25rem" }}>
          Something went wrong
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          {process.env.NODE_ENV === "development" && error.message
            ? error.message
            : "An unexpected error occurred. Please try again."}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="btn btn-primary"
          >
            <RefreshCw size={15} />
            Try Again
          </button>
          <Link href="/" className="btn btn-secondary">
            <Home size={15} />
            Go Home
          </Link>
        </div>

        {error.digest && (
          <p
            className="text-xs mt-6 font-mono"
            style={{ color: "var(--text-faint)" }}
          >
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
