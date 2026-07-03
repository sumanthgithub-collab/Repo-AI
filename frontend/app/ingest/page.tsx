"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  GitBranch,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { createApiClient } from "@/lib/api";
import type { Repo, IngestStatus } from "@/lib/types";

// ── Language toggles ────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  { value: "py",   label: "Python" },
  { value: "js",   label: "JavaScript" },
  { value: "ts",   label: "TypeScript" },
  { value: "jsx",  label: "JSX" },
  { value: "tsx",  label: "TSX" },
  { value: "java", label: "Java" },
  { value: "go",   label: "Go" },
  { value: "sql",  label: "SQL" },
  { value: "html", label: "HTML" },
  { value: "css",  label: "CSS" },
];

// ── Status Badge ─────────────────────────────────────────────────────────────

function RepoStatusBadge({
  status,
  chunkCount,
}: {
  status: Repo["status"];
  chunkCount: number;
}) {
  if (status === "INGESTING")
    return (
      <span className="badge badge-blue">
        <Loader2 size={10} className="animate-spin" /> Indexing
      </span>
    );
  if (status === "READY" && chunkCount < 10)
    return (
      <span className="badge badge-amber">
        <AlertTriangle size={10} /> Sparse Index ({chunkCount} chunks)
      </span>
    );
  if (status === "READY")
    return (
      <span className="badge badge-green">
        <CheckCircle size={10} /> Ready · {chunkCount} chunks
      </span>
    );
  if (status === "ERROR")
    return <span className="badge badge-red">Error</span>;
  return <span className="badge badge-gray">Pending</span>;
}

// ── Ingestion Progress Card ──────────────────────────────────────────────────

function IngestionProgress({
  repoId,
  getToken,
  onDone,
}: {
  repoId: string;
  getToken: () => Promise<string | null>;
  onDone: (status: IngestStatus) => void | Promise<void>;
}) {
  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const api = createApiClient(getToken);

  useEffect(() => {
    const poll = async () => {
      try {
        const s = await api.repos.getStatus(repoId);
        setStatus(s);
        if (s.status === "done" || s.status === "error") {
          if (intervalRef.current) clearInterval(intervalRef.current);
          void onDone(s);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Status check failed");
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [repoId]); // eslint-disable-line

  if (error) return <p className="text-sm" style={{ color: "var(--error)" }}>{error}</p>;
  if (!status) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Starting...</p>;

  const pct = status.progress_pct ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
        <span>{status.current_stage || "Processing..."}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--surface-3)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.max(5, pct)}%`,
            background: "var(--accent)",
          }}
        />
      </div>
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
        {status.embedded_chunks}/{status.total_chunks} chunks embedded
      </p>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function IngestPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  const [repos, setRepos] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [url, setUrl] = useState("");
  const [languages, setLanguages] = useState<string[]>(["py", "js", "ts"]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ingestingRepoId, setIngestingRepoId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const api = createApiClient(getToken);

  const fetchRepos = async () => {
    try {
      const list = await api.repos.list();
      setRepos(list);
    } catch { /* ignore on background refresh */ }
    finally { setLoadingRepos(false); }
  };

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/sign-in");
    if (isLoaded && isSignedIn) fetchRepos();
  }, [isLoaded, isSignedIn]); // eslint-disable-line

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await api.repos.create(url.trim(), languages);
      setUrl("");
      setIngestingRepoId(res.repoId);
      await fetchRepos();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to connect repo");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (repoId: string) => {
    if (!confirm("Delete this repo and all its chat sessions?")) return;
    setDeletingId(repoId);
    try {
      await api.repos.delete(repoId);
      setRepos((r) => r.filter((x) => x.id !== repoId));
      if (ingestingRepoId === repoId) setIngestingRepoId(null);
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen px-4 md:px-6 py-6 md:py-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold mb-2">Repository Workspace</h1>
          <p className="text-sm md:text-base">
            Connect repositories, track indexing, and launch into production-grade chat sessions.
          </p>
        </div>

        <div className="flex gap-6">
      {/* ── Left column: repo list ─────────────────── */}
      <aside
        className="hidden lg:flex flex-col"
        style={{
          width: "320px",
          flexShrink: 0,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--surface)",
          boxShadow: "var(--shadow-sm)",
          maxHeight: "calc(100vh - var(--navbar-h) - 110px)",
        }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Connected Repositories
            </span>
            <button
              onClick={fetchRepos}
              className="btn btn-ghost btn-sm"
              title="Refresh"
              aria-label="Refresh repos"
            >
              <RefreshCw size={13} />
            </button>
          </div>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            Ready repos open directly in chat workspace.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loadingRepos ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              ))}
            </div>
          ) : repos.length === 0 ? (
            <div className="py-10 text-center">
              <GitBranch size={24} className="mx-auto mb-3" style={{ color: "var(--text-faint)" }} />
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                No repos connected yet
              </p>
            </div>
          ) : (
            repos.map((repo) => (
              <div
                key={repo.id}
                className="group p-3 rounded-xl border cursor-pointer transition-all"
                style={{
                  background: "#fff",
                  borderColor: "var(--border)",
                }}
                onClick={() => {
                  if (repo.status === "READY") router.push(`/chat/${repo.id}`);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && repo.status === "READY") router.push(`/chat/${repo.id}`);
                }}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <GitBranch size={14} style={{ color: "var(--text-muted)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                      {repo.name.split("/")[1] || repo.name}
                    </p>
                    <div className="mt-1.5">
                      <RepoStatusBadge status={repo.status} chunkCount={repo.chunkCount} />
                    </div>
                    {repo.status === "ERROR" && repo.errorMsg ? (
                      <p className="mt-1 text-xs line-clamp-2" style={{ color: "var(--error)" }}>
                        {repo.errorMsg}
                      </p>
                    ) : null}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(repo.id); }}
                    className="btn btn-ghost btn-sm opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    disabled={deletingId === repo.id}
                    aria-label={`Delete ${repo.name}`}
                  >
                    {deletingId === repo.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Main: add repo form ────────────────────── */}
      <main className="flex-1 min-w-0">
        <div className="card p-5 md:p-7" style={{ background: "var(--surface)" }}>
          <h2 className="text-xl font-semibold mb-2">Connect New Repository</h2>
          <p className="text-sm mb-7">
            Paste a public GitHub URL and select languages to optimize indexing quality.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="repo-url" className="label">
                GitHub Repository URL
              </label>
              <input
                id="repo-url"
                type="url"
                className="input"
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label className="label">Language Filter</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {LANGUAGE_OPTIONS.map((opt) => {
                  const active = languages.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleLanguage(opt.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                      style={{
                        background: active ? "var(--accent-muted)" : "#fff",
                        color: active ? "var(--accent)" : "var(--text-muted)",
                        borderColor: active ? "#bcd1ff" : "var(--border)",
                      }}
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {submitError && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                style={{ background: "var(--error-muted)", color: "var(--error)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <AlertTriangle size={15} />
                {submitError}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full md:w-auto"
              disabled={submitting || !url.trim()}
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Starting Ingestion...</>
              ) : (
                <><Plus size={16} /> Connect Repository</>
              )}
            </button>
          </form>

          {/* Active ingestion progress */}
          {ingestingRepoId && (
            <div
              className="mt-7 p-5 rounded-xl"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Ingestion in Progress
                </p>
                <span className="badge badge-blue">
                  <Loader2 size={10} className="animate-spin" /> Running
                </span>
              </div>
              <IngestionProgress
                repoId={ingestingRepoId}
                getToken={getToken}
                onDone={async (status) => {
                  await fetchRepos();

                  if (status.status === "done") {
                    try {
                      const repo = await api.repos.get(ingestingRepoId);
                      if (repo.status === "READY") {
                        router.push(`/chat/${ingestingRepoId}`);
                        return;
                      }
                    } catch {
                      // Fall through and clear the progress card.
                    }
                  }

                  setIngestingRepoId(null);
                }}
              />
            </div>
          )}
        </div>

        {/* Mobile repo list */}
        {repos.length > 0 && (
          <div className="mt-6 lg:hidden">
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Connected Repositories
            </h2>
            <div className="space-y-2">
              {repos.map((repo) => (
                <div
                  key={repo.id}
                  className="card flex items-center gap-3 p-4 cursor-pointer"
                  style={{ background: "var(--surface)" }}
                  onClick={() => { if (repo.status === "READY") router.push(`/chat/${repo.id}`); }}
                  role="button"
                  tabIndex={0}
                >
                  <GitBranch size={16} style={{ color: "var(--text-muted)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{repo.name}</p>
                    <RepoStatusBadge status={repo.status} chunkCount={repo.chunkCount} />
                  </div>
                  {repo.status === "READY" && <ChevronRight size={16} style={{ color: "var(--text-faint)" }} />}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      </div>
      </div>
    </div>
  );
}
