"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Check, Zap, Users, Shield, Brain, GitBranch,
  MessageSquare, Loader2, Star,
} from "lucide-react";
import { createApiClient } from "@/lib/api";

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for exploring RepoTalk with personal projects.",
    cta: "Get Started",
    highlight: false,
    features: [
      "2 repositories",
      "50 queries / month",
      "Basic chat with citations",
      "Session history (7 days)",
      "Community support",
    ],
    unavailable: [
      "Repo Persona Intelligence",
      "Unlimited queries",
      "Priority model routing",
      "Team workspaces",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$9",
    period: "/ month",
    description: "For individual engineers who need unlimited codebase intelligence.",
    cta: "Start Pro",
    highlight: true,
    badge: "Most Popular",
    features: [
      "Unlimited repositories",
      "Unlimited queries",
      "Repo Persona Intelligence",
      "Suggested starter questions",
      "PR Review Assistant",
      "Session history (90 days)",
      "Bookmark & share answers",
      "Priority model routing",
      "Email support",
    ],
    unavailable: [
      "Team workspaces",
      "Shared repo library",
    ],
  },
  {
    id: "team" as const,
    name: "Team",
    price: "$29",
    period: "/ month",
    description: "For engineering teams that need shared context and collaboration.",
    cta: "Start Team",
    highlight: false,
    features: [
      "Everything in Pro",
      "Up to 10 team members",
      "Shared repository library",
      "Team session sharing",
      "Role-based access (Owner / Admin / Viewer)",
      "Shared bookmarks",
      "Usage analytics dashboard",
      "Priority support",
      "SSO / SAML (coming soon)",
    ],
    unavailable: [],
  },
];

const FEATURE_HIGHLIGHTS = [
  {
    icon: Brain,
    title: "Repo Persona Engine",
    description: "Auto-generates an identity card, architecture overview, and 5 contextual starter questions for every repo you connect.",
  },
  {
    icon: MessageSquare,
    title: "Cited Answers",
    description: "Every response links to the exact file and line range. No hallucinations — only code-grounded answers.",
  },
  {
    icon: GitBranch,
    title: "PR Review Assistant",
    description: "Paste a diff or GitHub PR URL and get risk assessment, changed function context, and suggested test cases.",
  },
  {
    icon: Shield,
    title: "Built for Privacy",
    description: "Your code never trains our models. Repos are indexed ephemerally and only stored as vector embeddings.",
  },
];

export default function PricingPage() {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = createApiClient(getToken);

  const handlePlanSelect = async (planId: "free" | "pro" | "team") => {
    if (planId === "free") {
      router.push(isSignedIn ? "/ingest" : "/sign-up");
      return;
    }

    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    setLoadingPlan(planId);
    setError(null);

    try {
      const { url } = await api.billing.checkout(planId);
      if (url) window.location.href = url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <main className="px-4 md:px-8 pb-24">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[900px] pt-16 md:pt-24 text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-soft-border)",
            color: "var(--accent)",
          }}
        >
          <Star size={12} />
          Simple, transparent pricing
        </div>
        <h1 className="mb-5">
          Choose the plan that<br />fits your workflow
        </h1>
        <p className="max-w-xl mx-auto text-[1.04rem]">
          Start free and upgrade when you need more power. No hidden fees, no vendor lock-in.
          Cancel anytime.
        </p>
      </section>

      {/* ── Plans ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1100px] pt-14">
        {error && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-6 max-w-md mx-auto"
            style={{ background: "var(--error-muted)", color: "var(--error)", border: "1px solid rgba(220,38,38,0.2)" }}
          >
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-5 items-start">
          {PLANS.map((plan) => {
            const isHighlight = plan.highlight;
            return (
              <div
                key={plan.id}
                className="card p-7 relative flex flex-col"
                style={
                  isHighlight
                    ? {
                        background: "linear-gradient(160deg, #f3f3ff 0%, #eeeeff 50%, #f0f0ff 100%)",
                        border: "2px solid var(--accent-soft-border)",
                        boxShadow: "0 8px 40px rgba(91,91,214,0.14), var(--shadow)",
                      }
                    : {
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        boxShadow: "var(--shadow-sm)",
                      }
                }
              >
                {/* Popular badge */}
                {plan.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      background: "linear-gradient(155deg, #6c6cdf 0%, #4d4dc9 100%)",
                      color: "#ffffff",
                      boxShadow: "var(--glow-accent)",
                    }}
                  >
                    {plan.badge}
                  </div>
                )}

                {/* Top accent bar for highlighted plan */}
                {isHighlight && (
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-[13px]"
                    style={{
                      background: "linear-gradient(90deg, #7b7be4 0%, #5b5bd6 50%, #9d7ce8 100%)",
                    }}
                  />
                )}

                <div className="mb-6">
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: isHighlight ? "var(--accent)" : "var(--text-faint)" }}
                  >
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1 mb-3">
                    <span
                      className="text-4xl font-bold"
                      style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
                    >
                      {plan.price}
                    </span>
                    <span className="text-sm mb-1.5" style={{ color: "var(--text-faint)" }}>
                      {plan.period}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {plan.description}
                  </p>
                </div>

                <button
                  onClick={() => handlePlanSelect(plan.id)}
                  disabled={loadingPlan === plan.id}
                  className="btn w-full justify-center mb-6"
                  style={
                    isHighlight
                      ? {
                          background: "linear-gradient(155deg, #6c6cdf 0%, #4d4dc9 100%)",
                          color: "#fff",
                          border: "none",
                          boxShadow: "var(--glow-accent)",
                        }
                      : {
                          background: "var(--surface)",
                          color: "var(--text)",
                          borderColor: "var(--border-light)",
                        }
                  }
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    plan.cta
                  )}
                </button>

                {/* Features */}
                <ul className="space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check
                        size={15}
                        className="flex-shrink-0 mt-0.5"
                        style={{ color: isHighlight ? "var(--accent)" : "var(--success)" }}
                      />
                      <span style={{ color: "var(--text-muted)" }}>{f}</span>
                    </li>
                  ))}
                  {plan.unavailable.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm opacity-35">
                      <div className="w-[15px] h-[15px] flex-shrink-0 mt-0.5 text-center leading-none" style={{ fontSize: "11px" }}>—</div>
                      <span style={{ color: "var(--text-faint)" }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Feature highlights ────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1100px] pt-24 pb-16">
        <div className="text-center mb-12">
          <h2>Everything you need to understand any codebase</h2>
          <p className="mt-3 max-w-2xl mx-auto">
            RepoTalk combines RAG retrieval, AST-aware chunking, and LLM reasoning to give you
            answers that are grounded, cited, and trustworthy.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURE_HIGHLIGHTS.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="card card-hover p-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "var(--accent-muted)" }}
                >
                  <Icon size={19} style={{ color: "var(--accent)" }} />
                </div>
                <h3 className="mb-2 text-base">{feature.title}</h3>
                <p className="text-sm">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FAQ strip ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[800px] pb-8">
        <h2 className="text-center mb-8">Common questions</h2>
        <div className="space-y-4">
          {[
            {
              q: "Can I switch plans?",
              a: "Yes. Upgrade or downgrade at any time. Prorated credits apply automatically.",
            },
            {
              q: "Is my code stored anywhere?",
              a: "We clone repos temporarily for indexing, then delete the local copy. Only vector embeddings of code chunks are stored — never raw source code.",
            },
            {
              q: "What LLMs power RepoTalk?",
              a: "Llama 3.3 70B via Groq for ultra-low latency. We're adding model selection (GPT-4o, Claude) for Pro users soon.",
            },
            {
              q: "Do you support private repositories?",
              a: "Public repos work today. Private repo support (via GitHub OAuth) is on our Q3 roadmap.",
            },
          ].map((item) => (
            <div
              key={item.q}
              className="card p-5"
              style={{ background: "var(--surface)" }}
            >
              <p className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>{item.q}</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
