"use client";

import { useState, useEffect, useRef } from "react";
import type { Citation } from "@/lib/types";
import { X, FileCode } from "lucide-react";

// ── Snippet Modal ─────────────────────────────────────────────────────────────

export function SnippetModal({
  citation,
  onClose,
}: {
  citation: Citation;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Code snippet from ${citation.file}`}
    >
      <div
        className="w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl fade-in"
        style={{
          background: "var(--code-bg)",
          border: "1px solid #2f3a52",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--code-border)" }}
        >
          <div className="flex items-center gap-2.5">
            <FileCode size={14} style={{ color: "var(--accent)" }} />
            <span
              className="font-mono text-xs font-medium"
              style={{ color: "var(--text)" }}
            >
              {citation.file}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                background: "var(--surface-3)",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              L{citation.startLine}–{citation.endLine}
            </span>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            aria-label="Close snippet"
          >
            <X size={14} />
          </button>
        </div>

        {/* Code */}
        <div className="overflow-auto flex-1 p-5">
          <pre className="font-mono text-sm leading-relaxed" style={{ color: "#c4cfe8", margin: 0 }}>
            <code>{citation.snippet}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Citation Chip ────────────────────────────────────────────────────────────

interface CitationChipProps {
  citation: Citation;
  index: number;
}

export default function CitationChip({ citation, index }: CitationChipProps) {
  const [open, setOpen] = useState(false);
  const fileName = citation.file.split("/").pop() ?? citation.file;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all"
        style={{
          background: "#ecf3ff",
          color: "#1d4ed8",
          border: "1px solid #cadcff",
          cursor: "pointer",
        }}
        title={`${citation.file}:${citation.startLine}-${citation.endLine}`}
        aria-label={`View code snippet from ${citation.file} lines ${citation.startLine} to ${citation.endLine}`}
      >
        <span
          className="font-sans text-[10px] px-1 py-px rounded"
          style={{
            background: "#dbe8ff",
            color: "#1d4ed8",
          }}
        >
          {index + 1}
        </span>
        {fileName}
        <span style={{ color: "var(--text-faint)" }}>:{citation.startLine}</span>
      </button>

      {open && (
        <SnippetModal citation={citation} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
