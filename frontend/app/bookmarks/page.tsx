"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bookmark, Search, Clock, MessageSquare, Loader2, GitBranch, RefreshCw, AlertTriangle } from "lucide-react";
import { createApiClient } from "@/lib/api";
import type { BookmarkedMessage } from "@/lib/types";
import CitationChip from "@/components/CitationChip";

export default function BookmarksPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = createApiClient(getToken);
      const data = await api.sessions.getBookmarks();
      setBookmarks(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load bookmarks";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    fetchBookmarks();
  }, [isLoaded, isSignedIn, fetchBookmarks]);

  const filteredBookmarks = bookmarks.filter((b) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      b.content.toLowerCase().includes(query) ||
      b.session.repo.name.toLowerCase().includes(query) ||
      (b.session.title && b.session.title.toLowerCase().includes(query))
    );
  });

  if (!isLoaded || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center px-4">
        <Bookmark size={40} className="mb-4" style={{ color: "var(--text-faint)" }} />
        <h2>Sign in to view bookmarks</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Your saved answers and code snippets will appear here.
        </p>
        <Link href="/sign-in" className="btn btn-primary mt-6">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 fade-in">
      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
            <Bookmark size={24} style={{ color: "var(--accent)" }} />
            Bookmarks
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Your personal knowledge base —{" "}
            <span style={{ color: "var(--text)" }}>{bookmarks.length}</span> saved{" "}
            {bookmarks.length === 1 ? "answer" : "answers"}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {bookmarks.length > 0 && (
            <div className="relative w-full md:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-faint)" }}
              />
              <input
                type="text"
                placeholder="Search bookmarks..."
                className="input pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search bookmarks"
              />
            </div>
          )}
          <button
            onClick={fetchBookmarks}
            className="btn btn-secondary flex items-center gap-1.5 shrink-0"
            title="Refresh bookmarks"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="mb-6 flex items-center gap-3 rounded-xl p-4 text-sm"
          style={{ background: "#fef2f2", color: "#c0392b", border: "1px solid #fca5a5" }}
        >
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
          <button
            onClick={fetchBookmarks}
            className="ml-auto font-medium underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!error && bookmarks.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-2xl py-16 text-center"
          style={{ border: "1px dashed var(--border)" }}
        >
          <div
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <Bookmark size={20} style={{ color: "var(--text-faint)" }} />
          </div>
          <h3 className="mb-1 text-base font-semibold">No bookmarks yet</h3>
          <p className="max-w-xs text-sm" style={{ color: "var(--text-muted)" }}>
            When you get an answer in a chat, click the bookmark icon to save it here.
          </p>
          <Link href="/ingest" className="btn btn-secondary mt-5">
            Browse Repositories
          </Link>
        </div>
      )}

      {/* No search results */}
      {!error && bookmarks.length > 0 && filteredBookmarks.length === 0 && (
        <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          No bookmarks match &quot;{searchQuery}&quot;.
        </div>
      )}

      {/* Bookmark Cards */}
      {filteredBookmarks.length > 0 && (
        <div className="space-y-5">
          {filteredBookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {/* Card Header */}
              <div
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                style={{
                  background: "var(--surface-2)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold"
                    style={{
                      background: "var(--accent-soft)",
                      border: "1px solid var(--accent-soft-border)",
                      color: "var(--accent)",
                    }}
                  >
                    <GitBranch size={11} />
                    {bookmark.session.repo.name}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {bookmark.session.title || "Untitled Session"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-faint)" }}>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {new Date(bookmark.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {" "}
                    {new Date(bookmark.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <Link
                    href={`/chat/${bookmark.session.repo.id}?session=${bookmark.session.id}`}
                    className="flex items-center gap-1 font-medium hover:underline"
                    style={{ color: "var(--accent)" }}
                  >
                    <MessageSquare size={11} />
                    Open in Chat
                  </Link>
                </div>
              </div>

              {/* Card Content */}
              <div className="px-5 py-4">
                <div
                  className="prose prose-sm max-w-none break-words"
                  style={{ color: "var(--text)", lineHeight: "1.75" }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code: ({ children, className }) => {
                        const isBlock = className?.includes("language-");
                        return isBlock ? (
                          <pre className="code-block my-3" style={{ fontSize: "0.79rem" }}>
                            <code>{children}</code>
                          </pre>
                        ) : (
                          <code
                            style={{
                              padding: "0.1em 0.4em",
                              borderRadius: "5px",
                              background: "var(--accent-soft)",
                              color: "var(--accent)",
                              fontSize: "0.83em",
                              border: "1px solid var(--accent-soft-border)",
                            }}
                          >
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {bookmark.content}
                  </ReactMarkdown>
                </div>

                {/* Citations */}
                {bookmark.citations && bookmark.citations.length > 0 && (
                  <div
                    className="mt-4 flex flex-wrap gap-1.5 pt-3"
                    style={{ borderTop: "1px dashed var(--border)" }}
                  >
                    {bookmark.citations.map((c, i) => (
                      <CitationChip key={i} citation={c} index={i} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
