"use client";

import { useState } from "react";
import {
  Brain, Code2, Layers, GitBranch, Zap, BookOpen,
  ChevronDown, ChevronUp, RefreshCw, FileCode2,
  Terminal, Globe, Package, Cpu, Shield,
} from "lucide-react";
import type { RepoPersona, SuggestedQuestion } from "@/lib/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  architecture:   { bg: "var(--accent-soft)",          text: "var(--accent)",  border: "var(--accent-soft-border)" },
  implementation: { bg: "#edfbf4",                     text: "#065f46",        border: "#b7ebd7" },
  debugging:      { bg: "#fff7ed",                     text: "#92400e",        border: "#fed7aa" },
  onboarding:     { bg: "#f5f0ff",                     text: "#6d28d9",        border: "#d8b4fe" },
};

const CATEGORY_DEFAULT = { bg: "var(--surface-2)", text: "var(--text-muted)", border: "var(--border)" };

const LANG_ICONS: Record<string, string> = {
  Python: "🐍", TypeScript: "📘", JavaScript: "📜", Go: "🐹",
  Java: "☕", "C#": "🎯", Rust: "⚙️", Ruby: "💎", PHP: "🐘",
  Kotlin: "🦄", Swift: "🐦",
};

const REPO_TYPE_ICONS: Record<string, React.ElementType<{ size?: number | string; style?: React.CSSProperties; className?: string }>> = {
  "web-api": Globe, frontend: Code2, cli: Terminal, library: Package,
  monorepo: Layers, "ml-model": Cpu,
};

const EXPERTISE_BADGE: Record<string, { label: string; className: string }> = {
  "beginner-friendly": { label: "Beginner Friendly", className: "badge-green" },
  intermediate:        { label: "Intermediate",       className: "badge-blue"  },
  expert:              { label: "Expert Level",        className: "badge-indigo"},
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StackPill({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
      style={{ background: "var(--surface-3)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
    >
      {LANG_ICONS[label] && <span>{LANG_ICONS[label]}</span>}
      {label}
    </span>
  );
}

function EntryPointChip({ path }: { path: string }) {
  const filename = path.split("/").pop() || path;
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono"
      style={{
        background: "var(--surface-2)",
        color: "var(--text-muted)",
        border: "1px solid var(--border)",
      }}
    >
      <FileCode2 size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />
      <span className="truncate" title={path}>{filename}</span>
    </div>
  );
}

// ── Main PersonaCard ───────────────────────────────────────────────────────────

export interface PersonaCardProps {
  persona: RepoPersona;
  repoName?: string;
  onQuestionSelect?: (question: string) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  /** Compact mode hides the onboarding guide and file tree */
  compact?: boolean;
}

export default function PersonaCard({
  persona,
  repoName,
  onQuestionSelect,
  onRegenerate,
  isRegenerating = false,
  compact = false,
}: PersonaCardProps) {
  const [showGuide, setShowGuide] = useState(false);
  const [showTree, setShowTree] = useState(false);

  const expertiseBadge = EXPERTISE_BADGE[persona.expertise_level] ??
    { label: persona.expertise_level, className: "badge-gray" };

  const RepoTypeIcon = REPO_TYPE_ICONS[persona.repo_type] ?? GitBranch;

  return (
    <div className="space-y-4 fade-in">
      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: "linear-gradient(135deg, var(--accent-soft) 0%, #f8f8ff 100%)",
          border: "1px solid var(--accent-soft-border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(155deg, #6c6cdf 0%, #4d4dc9 100%)",
                boxShadow: "0 4px 12px rgba(91,91,214,0.28)",
              }}
            >
              <RepoTypeIcon size={19} style={{ color: "#fff" }} />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight" style={{ color: "var(--text)" }}>
                {repoName || persona.repo_name}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                {persona.dominant_language} · {persona.architecture_style}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`badge ${expertiseBadge.className}`}>
              {expertiseBadge.label}
            </span>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="btn btn-ghost btn-sm"
                title="Regenerate persona"
                aria-label="Regenerate repo persona"
              >
                <RefreshCw size={13} className={isRegenerating ? "animate-spin" : ""} />
              </button>
            )}
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Files indexed", value: persona.total_files.toLocaleString() },
            { label: "Code chunks",   value: persona.total_chunks.toLocaleString() },
            { label: "Frameworks",    value: persona.frameworks.length.toString() },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl p-3 text-center"
              style={{ background: "rgba(255,255,255,0.75)", border: "1px solid var(--accent-soft-border)" }}
            >
              <p className="text-base font-bold" style={{ color: "var(--text)" }}>
                {metric.value}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                {metric.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tech stack ──────────────────────────────────────────────────── */}
      <div
        className="rounded-xl p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} style={{ color: "var(--accent)" }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            Tech Stack
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {persona.stack.map((tech) => (
            <StackPill key={tech} label={tech} />
          ))}
        </div>
      </div>

      {/* ── Architecture overview ────────────────────────────────────────── */}
      {persona.architecture_overview && (
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Brain size={14} style={{ color: "var(--accent)" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Architecture Overview
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {persona.architecture_overview}
          </p>
        </div>
      )}

      {/* ── Key entry points ─────────────────────────────────────────────── */}
      {persona.key_entry_points.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} style={{ color: "var(--accent)" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Key Files to Know
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {persona.key_entry_points.map((path) => (
              <EntryPointChip key={path} path={path} />
            ))}
          </div>
        </div>
      )}

      {/* ── Suggested questions ──────────────────────────────────────────── */}
      {persona.suggested_questions.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Layers size={14} style={{ color: "var(--accent)" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
              Suggested Questions
            </span>
          </div>
          <div className="space-y-2">
            {persona.suggested_questions.map((q, i) => {
              const colors = CATEGORY_COLORS[q.category] ?? CATEGORY_DEFAULT;
              return (
                <button
                  key={i}
                  onClick={() => onQuestionSelect?.(q.question)}
                  disabled={!onQuestionSelect}
                  className="w-full text-left rounded-xl px-3 py-2.5 text-sm transition-all"
                  style={{
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    color: "var(--text)",
                    cursor: onQuestionSelect ? "pointer" : "default",
                  }}
                  onMouseEnter={(e) => {
                    if (onQuestionSelect) {
                      (e.currentTarget as HTMLButtonElement).style.transform = "translateX(2px)";
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow-sm)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateX(0)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="inline-flex items-center justify-center rounded-md w-5 h-5 text-[10px] font-bold flex-shrink-0 mt-0.5"
                      style={{ background: colors.border, color: colors.text }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-xs block mb-0.5" style={{ color: colors.text }}>
                        {q.label}
                      </span>
                      <span className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        {q.question}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Onboarding guide (collapsible) ──────────────────────────────── */}
      {!compact && persona.onboarding_guide && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <button
            onClick={() => setShowGuide((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors"
            style={{
              background: showGuide ? "var(--surface-2)" : "var(--surface)",
              color: "var(--text)",
            }}
          >
            <div className="flex items-center gap-2">
              <BookOpen size={14} style={{ color: "var(--accent)" }} />
              Onboarding Guide
            </div>
            {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showGuide && (
            <div
              className="px-4 py-4 text-sm space-y-3"
              style={{
                background: "var(--surface)",
                borderTop: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              <div
                className="prose prose-sm max-w-none"
                style={{ lineHeight: "1.75" }}
                dangerouslySetInnerHTML={{
                  __html: persona.onboarding_guide
                    .replace(/^## (.+)$/gm, '<h3 style="font-size:0.95rem;font-weight:600;color:var(--text);margin:12px 0 6px">$1</h3>')
                    .replace(/^### (.+)$/gm, '<h4 style="font-size:0.88rem;font-weight:600;color:var(--text-muted);margin:8px 0 4px">$1</h4>')
                    .replace(/^\d+\. (.+)$/gm, '<p style="margin:4px 0;padding-left:1rem">• $1</p>')
                    .replace(/`([^`]+)`/g, '<code style="padding:0.1em 0.35em;background:var(--accent-soft);color:var(--accent);border-radius:4px;font-size:0.82em">$1</code>')
                    .replace(/\n\n/g, "<br/>"),
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── File tree (collapsible) ──────────────────────────────────────── */}
      {!compact && persona.file_tree && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <button
            onClick={() => setShowTree((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors"
            style={{
              background: showTree ? "var(--surface-2)" : "var(--surface)",
              color: "var(--text)",
            }}
          >
            <div className="flex items-center gap-2">
              <GitBranch size={14} style={{ color: "var(--accent)" }} />
              Repository Structure
            </div>
            {showTree ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showTree && (
            <pre
              className="px-4 py-4 text-xs overflow-x-auto"
              style={{
                background: "var(--code-bg)",
                color: "var(--code-text)",
                fontFamily: "var(--font-mono)",
                lineHeight: "1.6",
                borderTop: "1px solid var(--code-border)",
                margin: 0,
              }}
            >
              {persona.file_tree}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton variant ───────────────────────────────────────────────────────────

export function PersonaCardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-soft-border)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="skeleton w-11 h-11 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 rounded w-3/4" />
            <div className="skeleton h-3 rounded w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.7)", border: "1px solid var(--accent-soft-border)" }}
            >
              <div className="skeleton h-5 rounded w-12 mx-auto mb-1" />
              <div className="skeleton h-3 rounded w-16 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Stack */}
      <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="skeleton h-3 rounded w-20 mb-3" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-6 rounded-lg w-20" />)}
        </div>
      </div>

      {/* Questions */}
      <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="skeleton h-3 rounded w-32 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
