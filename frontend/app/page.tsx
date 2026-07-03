import Link from "next/link";
import {
  Brain,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  GitBranch,
  FileCode2,
  Layers3,
  Workflow,
} from "lucide-react";

const METRICS = [
  { label: "Time to first answer", value: "< 60 sec" },
  { label: "Grounded outputs", value: "File + line cited" },
  { label: "Built for teams", value: "Session history + bookmarks" },
];

const FEATURES = [
  {
    icon: Brain,
    title: "Answers with reasoning context",
    description: "Ask high-level architecture questions and get code-aware responses grounded in actual repository context.",
  },
  {
    icon: FileCode2,
    title: "Citations that are inspectable",
    description: "Every key claim can include a source file and line range so engineers can verify answers immediately.",
  },
  {
    icon: Layers3,
    title: "Repository-scale retrieval",
    description: "The pipeline indexes entire public repositories and keeps retrieval quality focused on implementation details.",
  },
  {
    icon: Workflow,
    title: "Designed for active workflows",
    description: "Move from onboarding to debugging to implementation questions without context switching across tools.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Connect a Repository",
    description: "Paste any public GitHub URL. RepoTalk indexes it in the background.",
  },
  {
    number: "02",
    title: "Ask in Plain English",
    description: "Type questions like you would to a senior engineer who knows the repo.",
  },
  {
    number: "03",
    title: "Get Cited Answers",
    description: "Every response links to the exact files and lines so you can verify instantly.",
  },
];

export default function LandingPage() {
  return (
    <main className="px-5 md:px-8 pb-20">
      <section className="mx-auto max-w-[1180px] pt-16 md:pt-24">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <Sparkles size={12} style={{ color: "var(--accent)" }} />
              Premium AI code research workspace
            </div>

            <h1 className="max-w-xl mb-5">
              Understand any repository like the engineer who wrote it.
            </h1>
            <p className="max-w-xl text-[1.04rem] mb-8">
              RepoTalk turns codebases into a high-signal conversation interface.
              Ask implementation questions, receive cited answers, and keep team context persistent.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/ingest" className="btn btn-primary btn-lg">
                Start with a repository
                <ArrowRight size={16} />
              </Link>
              <Link href="/sign-in" className="btn btn-secondary btn-lg">
                Sign In
              </Link>
            </div>

            <div className="mt-8 grid sm:grid-cols-3 gap-3">
              {METRICS.map((metric) => (
                <div key={metric.label} className="card p-4" style={{ background: "var(--surface-2)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{metric.value}</p>
                  <p className="text-xs mt-1">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="card p-6 md:p-7"
            style={{
              background: "linear-gradient(180deg,#ffffff 0%,#f7f9ff 100%)",
              borderColor: "#dbe5f5",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#22c55e" }} />
              <p className="text-xs ml-2" style={{ color: "var(--text-faint)" }}>repotalk session</p>
            </div>

            <div className="space-y-4 text-sm">
              <div className="p-3 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <p className="text-xs mb-1" style={{ color: "var(--text-faint)" }}>You</p>
                <p style={{ color: "var(--text)" }}>Where is authentication validated in this repo?</p>
              </div>
              <div className="p-3 rounded-xl" style={{ background: "#ecf3ff", border: "1px solid #cfdffe" }}>
                <p className="text-xs mb-1" style={{ color: "#1d4ed8" }}>RepoTalk</p>
                <p style={{ color: "#0f172a" }}>
                  Authentication is enforced in `middleware/auth.ts` via Clerk JWT verification and user context injection.
                </p>
                <div className="mt-2 inline-flex items-center gap-2 text-xs px-2 py-1 rounded-lg" style={{ background: "#ffffff", border: "1px solid #cbdaf8", color: "#1e40af" }}>
                  <FileCode2 size={12} />
                  middleware/auth.ts:32-61
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] py-20">
        <div className="text-center mb-12">
          <h2>How teams use RepoTalk</h2>
          <p className="mt-3 max-w-2xl mx-auto">
            Built for engineers who need fast, trusted context from unfamiliar codebases.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          {STEPS.map((step) => (
            <div key={step.number} className="card card-hover p-6">
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--accent)" }}>
                STEP {step.number}
              </p>
              <h3 className="mb-2">{step.title}</h3>
              <p className="text-sm">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] pb-20">
        <div className="grid md:grid-cols-2 gap-5">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="card card-hover p-6 md:p-7">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "var(--accent-muted)" }}
                >
                  <Icon size={19} style={{ color: "var(--accent)" }} />
                </div>
                <h3 className="mb-2">{feature.title}</h3>
                <p className="text-sm">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[980px] pb-14">
        <div
          className="card p-8 md:p-10 text-center"
          style={{
            background: "linear-gradient(180deg,#ffffff 0%,#f3f7ff 100%)",
            borderColor: "#dbe5f5",
          }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4" style={{ background: "#e8f0ff", color: "#1d4ed8" }}>
            <ShieldCheck size={12} />
            Trusted answers, production flow
          </div>
          <h2 className="mb-3">Ready to ship faster with repository clarity?</h2>
          <p className="max-w-xl mx-auto mb-7">
            Connect a repository, ask focused engineering questions, and get verifiable answers with session continuity.
          </p>
          <Link href="/ingest" className="btn btn-primary btn-lg">
            Connect your first repo
            <GitBranch size={16} />
          </Link>
        </div>
      </section>
      <footer
        className="mx-auto max-w-[1180px] py-7 text-center text-xs"
        style={{
          borderTop: "1px solid var(--border)",
          color: "var(--text-faint)",
        }}
      >
        RepoTalk · Professional developer assistant for codebase intelligence
      </footer>
    </main>
  );
}
