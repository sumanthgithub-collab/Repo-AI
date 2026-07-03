"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, UserButton, SignInButton } from "@clerk/nextjs";
import { Sparkles, MessageSquare, LayoutDashboard, Bookmark } from "lucide-react";

const NAV_LINKS = [
  { href: "/ingest", label: "Repos", icon: LayoutDashboard },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        height: "var(--navbar-h)",
        background: "rgba(246,248,251,0.88)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--border)",
      }}
      aria-label="Main navigation"
    >
      <div className="mx-auto h-full w-full max-w-[1300px] px-4 md:px-6 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold text-[15px] text-[var(--text)] no-underline"
          aria-label="RepoTalk home"
        >
          <span
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{
              color: "#fff",
              background: "linear-gradient(180deg,#3878f7 0%,#2458c9 100%)",
              boxShadow: "var(--glow-accent)",
            }}
            aria-hidden="true"
          >
            <MessageSquare size={15} strokeWidth={2.4} />
          </span>
          <div className="flex flex-col leading-none">
            <span className="tracking-tight">RepoTalk</span>
            <span className="text-[11px] font-medium" style={{ color: "var(--text-faint)" }}>
              Developer AI Workspace
            </span>
          </div>
        </Link>

        {/* Center nav */}
        <SignedIn>
          <div
            className="hidden md:flex items-center gap-1 p-1 rounded-xl"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all no-underline"
                  style={{
                    color: active ? "var(--accent)" : "var(--text-muted)",
                    background: active ? "#ffffff" : "transparent",
                    boxShadow: active ? "var(--shadow-sm)" : "none",
                  }}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              );
            })}
          </div>
          <Link
            href="/ingest"
            className="md:hidden btn btn-secondary btn-sm"
            aria-label="Open repositories"
          >
            <LayoutDashboard size={14} />
            Repos
          </Link>
        </SignedIn>

        {/* Right — auth */}
        <div className="flex items-center gap-2 md:gap-3">
          <div
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
            style={{
              background: "var(--surface)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            <Sparkles size={12} style={{ color: "var(--accent)" }} />
            Premium UI Mode
          </div>

          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn btn-primary btn-sm">Sign In</button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                },
              }}
            />
          </SignedIn>
        </div>
      </div>
    </nav>
  );
}
