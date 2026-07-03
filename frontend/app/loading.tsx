import { Loader2 } from "lucide-react";

/**
 * Route-level loading skeleton — shown by Next.js App Router
 * while the page's async Server Component is fetching.
 */
export default function Loading() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(180deg,#3878f7 0%,#2458c9 100%)",
            boxShadow: "var(--glow-accent)",
          }}
        >
          <Loader2 size={22} className="animate-spin" color="#fff" />
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          Loading RepoTalk…
        </p>
      </div>
    </div>
  );
}
