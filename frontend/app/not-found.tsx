import Link from "next/link";
import { GitBranch, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="text-center max-w-md">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
          style={{
            background: "var(--surface-3)",
            border: "1px solid var(--border)",
          }}
        >
          <GitBranch size={36} style={{ color: "var(--text-faint)" }} />
        </div>

        <p
          className="text-sm font-semibold mb-2 uppercase tracking-wider"
          style={{ color: "var(--accent)" }}
        >
          404 — Page not found
        </p>
        <h1
          className="mb-4"
          style={{ fontSize: "clamp(1.8rem, 5vw, 2.8rem)", fontWeight: 600 }}
        >
          This page doesn&apos;t exist
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          The URL you visited doesn&apos;t match any page in RepoTalk.
          It may have been moved, deleted, or you may have mistyped the address.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn btn-primary">
            <Home size={15} />
            Back to Home
          </Link>
          <Link href="/ingest" className="btn btn-secondary">
            <GitBranch size={15} />
            My Repositories
          </Link>
        </div>
      </div>
    </div>
  );
}
