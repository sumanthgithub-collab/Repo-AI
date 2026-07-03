"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  CreditCard, CheckCircle, Calendar, Zap,
  ExternalLink, Loader2, AlertTriangle, ArrowRight,
} from "lucide-react";
import { createApiClient } from "@/lib/api";
import type { BillingStatus } from "@/lib/types";

function BillingPageSkeleton() {
  return (
    <div className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[640px]">
        <div className="skeleton h-8 rounded w-48 mb-2" />
        <div className="skeleton h-4 rounded w-72 mb-10" />
        <div className="card p-6">
          <div className="skeleton h-6 rounded w-32 mb-4" />
          <div className="skeleton h-16 rounded mb-4" />
          <div className="skeleton h-10 rounded w-40" />
        </div>
      </div>
    </div>
  );
}

const PLAN_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  free:  { label: "Free",  color: "#475569", bg: "#eef2f7" },
  pro:   { label: "Pro",   color: "#1d4ed8", bg: "#e8efff" },
  team:  { label: "Team",  color: "#6b21a8", bg: "#f3e8ff" },
};

export default function BillingPage() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const router = useRouter();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = createApiClient(getToken);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/sign-in");
    if (isLoaded && isSignedIn) fetchBilling();
  }, [isLoaded, isSignedIn]); // eslint-disable-line

  const fetchBilling = async () => {
    try {
      const b = await api.billing.status();
      setBilling(b);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load billing info");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    setLoadingPortal(true);
    try {
      const { url } = await api.billing.portal();
      if (url) window.location.href = url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not open billing portal");
    } finally {
      setLoadingPortal(false);
    }
  };

  if (!isLoaded || loading) return <BillingPageSkeleton />;

  const planInfo = PLAN_LABELS[billing?.plan ?? "free"] ?? PLAN_LABELS.free;
  const hasPaidPlan = billing?.plan && billing.plan !== "free";

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[640px]">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2">Billing & Plan</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Manage your subscription, view usage, and update payment details.
          </p>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-5"
            style={{ background: "var(--error-muted)", color: "var(--error)", border: "1px solid rgba(220,38,38,0.2)" }}
          >
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* Current plan card */}
        <div className="card p-6 mb-5">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-faint)" }}>
                Current Plan
              </p>
              <div className="flex items-center gap-2">
                <span
                  className="px-3 py-1 rounded-lg text-sm font-bold"
                  style={{ background: planInfo.bg, color: planInfo.color }}
                >
                  {planInfo.label}
                </span>
                {billing?.subscription?.status === "active" && (
                  <span className="badge badge-green">
                    <CheckCircle size={10} /> Active
                  </span>
                )}
                {billing?.subscription?.cancelAtPeriodEnd && (
                  <span className="badge badge-amber">Cancels at period end</span>
                )}
              </div>
            </div>
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--accent-muted)" }}
            >
              <CreditCard size={19} style={{ color: "var(--accent)" }} />
            </div>
          </div>

          {billing?.subscription && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div
                className="rounded-xl p-3"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar size={12} style={{ color: "var(--text-faint)" }} />
                  <span className="text-xs font-semibold" style={{ color: "var(--text-faint)" }}>Renews</span>
                </div>
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
              <div
                className="rounded-xl p-3"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap size={12} style={{ color: "var(--text-faint)" }} />
                  <span className="text-xs font-semibold" style={{ color: "var(--text-faint)" }}>Status</span>
                </div>
                <p className="text-sm font-semibold capitalize" style={{ color: "var(--text)" }}>
                  {billing.subscription.status}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {hasPaidPlan ? (
              <button
                onClick={handleOpenPortal}
                disabled={loadingPortal}
                className="btn btn-primary"
              >
                {loadingPortal ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ExternalLink size={15} />
                )}
                Manage Billing
              </button>
            ) : (
              <button
                onClick={() => router.push("/pricing")}
                className="btn btn-primary"
              >
                <Zap size={15} />
                Upgrade to Pro
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Free plan features reminder */}
        {!hasPaidPlan && (
          <div
            className="card p-6"
            style={{
              background: "linear-gradient(135deg, #f0f5ff 0%, #f8f9ff 100%)",
              border: "1px solid #dbe5f5",
            }}
          >
            <h3 className="text-base font-semibold mb-2">Unlock Pro features</h3>
            <ul className="space-y-2 mb-5">
              {[
                "Unlimited repositories & queries",
                "Repo Persona Intelligence (identity card + starter questions)",
                "PR Review Assistant",
                "Priority model routing",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  <CheckCircle size={14} style={{ color: "var(--accent)" }} />
                  {f}
                </li>
              ))}
            </ul>
            <button onClick={() => router.push("/pricing")} className="btn btn-primary btn-sm">
              View Plans
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
