"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, File } from "lucide-react";
import type { MockTreeNode } from "@/lib/repoExplorer";

function TreeRow({
  node,
  depth,
  onSelect,
  selectedPath,
}: {
  node: MockTreeNode;
  depth: number;
  onSelect: (path: string) => void;
  selectedPath: string | null;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isDir = Boolean(node.children?.length);
  const selected = selectedPath === node.path;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (isDir) {
            setOpen((o) => !o);
          } else {
            onSelect(node.path);
          }
        }}
        className="w-full flex items-center gap-1.5 text-left rounded-md py-1.5 px-2 transition-colors"
        style={{
          paddingLeft: `${8 + depth * 12}px`,
          background: selected && !isDir ? "#eff5ff" : "transparent",
          border: selected && !isDir ? "1px solid #cdddfb" : "1px solid transparent",
          color: "var(--text-muted)",
        }}
      >
        {isDir ? (
          <span className="flex-shrink-0" style={{ color: "var(--text-faint)" }}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="w-[14px] flex-shrink-0" />
        )}
        {isDir ? (
          <Folder size={14} className="flex-shrink-0" style={{ color: "var(--accent)" }} />
        ) : (
          <File size={14} className="flex-shrink-0" style={{ color: "var(--text-faint)" }} />
        )}
        <span className="text-xs font-mono truncate">{node.name}</span>
      </button>
      {isDir && open && node.children && (
        <div>
          {node.children.map((ch) => (
            <TreeRow
              key={ch.path}
              node={ch}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MockFileTree({
  roots,
  selectedPath,
  onSelectPath,
}: {
  roots: MockTreeNode[];
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
}) {
  return (
    <div className="py-1">
      {roots.map((n) => (
        <TreeRow
          key={n.path}
          node={n}
          depth={0}
          onSelect={onSelectPath}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}
