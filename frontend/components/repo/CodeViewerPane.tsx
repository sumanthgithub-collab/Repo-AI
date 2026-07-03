"use client";

import { FileCode } from "lucide-react";
import type { RepoExplorerState } from "@/lib/repoExplorer";

interface CodeViewerPaneProps {
  explorer: RepoExplorerState;
  fileLabel?: string | null;
}

export default function CodeViewerPane({
  explorer,
  fileLabel,
}: CodeViewerPaneProps) {
  const path = fileLabel ?? explorer.selectedFilePath;

  if (explorer.codeDisplayMode === "none") {
    return (
      <div
        className="flex flex-col items-center justify-center text-center px-6 py-12"
        style={{ minHeight: "200px" }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
          style={{
            background: "var(--surface-3)",
            border: "1px solid var(--border)",
          }}
        >
          <FileCode size={20} style={{ color: "var(--accent)" }} />
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
          No file in view
        </p>
        <p className="text-xs max-w-[220px]" style={{ color: "var(--text-muted)" }}>
          Open a citation chip, pick a path from the file tree, or choose a symbol
          to preview code here.
        </p>
      </div>
    );
  }

  if (explorer.codeDisplayMode === "file") {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div
          className="flex-shrink-0 px-3 py-2 flex items-center gap-2 border-b"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          <FileCode size={13} style={{ color: "var(--accent)" }} />
          <span
            className="text-xs font-mono truncate"
            style={{ color: "var(--text)" }}
            title={path ?? undefined}
          >
            {path ?? "Unknown path"}
          </span>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>
            Full-file contents will appear here once the repository file API is
            connected.
          </p>
          {explorer.highlightedRange && (
            <p className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
              Requested focus: L{explorer.highlightedRange.startLine}
              {explorer.highlightedRange.endLine !==
              explorer.highlightedRange.startLine
                ? `–L${explorer.highlightedRange.endLine}`
                : ""}
            </p>
          )}
        </div>
      </div>
    );
  }

  // citation mode
  const snippet = explorer.citationSnippet ?? "";
  const lines = snippet.length > 0 ? snippet.split("\n") : [""];
  const anchor = explorer.citationAnchorLine ?? 1;
  const hl = explorer.highlightedRange;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex-shrink-0 px-3 py-2 flex items-center justify-between gap-2 border-b flex-wrap"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileCode size={13} style={{ color: "var(--accent)" }} />
          <span
            className="text-xs font-mono truncate"
            style={{ color: "var(--text)" }}
            title={path ?? undefined}
          >
            {path ?? "citation"}
          </span>
        </div>
        {hl && (
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-md flex-shrink-0"
            style={{
              background: "#ecf3ff",
              color: "#1d4ed8",
              border: "1px solid #cadcff",
            }}
          >
            L{hl.startLine}–{hl.endLine}
          </span>
        )}
      </div>
      <div
        className="flex-1 overflow-auto font-mono text-[13px] leading-relaxed"
        style={{
          background: "var(--code-bg)",
          color: "#c4cfe8",
        }}
      >
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => {
              const lineNo = anchor + i;
              const inRange =
                hl &&
                lineNo >= hl.startLine &&
                lineNo <= hl.endLine;
              return (
                <tr
                  key={`${lineNo}-${i}`}
                  style={{
                    background: inRange
                      ? "rgba(37, 99, 235, 0.22)"
                      : "transparent",
                  }}
                >
                  <td
                    className="select-none text-right pr-3 pl-2 py-0.5 align-top whitespace-nowrap"
                    style={{
                      width: "1%",
                      color: "rgba(148, 163, 184, 0.85)",
                      borderRight: "1px solid var(--code-border)",
                      background: inRange
                        ? "rgba(37, 99, 235, 0.12)"
                        : "rgba(15, 23, 42, 0.35)",
                    }}
                  >
                    {lineNo}
                  </td>
                  <td
                    className="pl-3 pr-4 py-0.5 align-top whitespace-pre-wrap break-all"
                    style={{ color: "#e2e8f0" }}
                  >
                    {line || " "}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
