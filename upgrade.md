# RepoTalk Product Upgrade — Phased Plan

## Overview

| Phase | Name | Focus | Depends on |
|-------|------|--------|------------|
| 1 | Chat stability & guards | Fix duplicate sends, core reliability | — |
| 2 | Premium chat UX | ChatGPT-style interface | Phase 1 |
| 3 | Repo Identity Card | Auto-generated repo profile | Phase 1 (Phase 2 optional) |
| 4 | Stripe billing | Plans, limits, payments | Phase 1 |
| 5 | App-wide polish & launch | Design system, a11y, QA | Phases 1–4 |

---

# Phase 1 — Chat Stability & Duplicate Submit Fix

**Goal:** One question = one message = one API call. No regressions in auth or sessions.

## Scope

- Find and fix duplicate submission root cause(s)
- Lock input/submit while loading or streaming
- Abort in-flight stream when user switches session or navigates away
- Gateway: optional idempotency key or duplicate guard on rapid repeats
- Clear states: idle → sending → streaming → done / error

## Tasks

- Audit ChatPanel, StreamingText, chat route handlers for double-fire (Strict Mode, Enter spam, double-click, optimistic UI + refresh race)
- Add streaming / isSubmitting guards on Send button and Enter handler
- Use AbortController for SSE; cancel on session change/unmount
- Debounce or ignore duplicate identical questions within ~2s window
- Verify gateway persists user message once per request
- Manual tests: rapid clicks, Enter spam, mid-stream session switch, retry after error

## Done when

- Sending the same question 5× fast produces 1 user message and 1 stream
- Submit disabled during stream; user cannot spam Send
- Switching session mid-stream cancels cleanly without duplicate assistant messages

## Estimated effort

**3–5 days**

---

# Phase 2 — Premium Chat UX (ChatGPT-style)

**Goal:** Chat feels modern, calm, and production-ready.

## Scope

- Message layout (user right, assistant left + avatar)
- Markdown + code syntax highlighting for assistant replies
- Sticky bottom input, auto-resize textarea, Enter / Shift+Enter
- SSE streaming UX: typing indicator, Stop button
- Session sidebar: list, new chat, rename, delete, sort by updatedAt
- Empty state + suggested starter questions (static first; repo-specific in Phase 3)
- Copy message, bookmark (keep), optional regenerate
- Citation chips below answers
- Scroll: auto-scroll on new tokens; don’t force scroll if user scrolled up
- Mobile responsive layout
- Subtle animations + prefers-reduced-motion

## Tasks

- Refactor chat page layout (sidebar + main panel)
- Add markdown renderer (react-markdown + GFM + code blocks)
- Redesign MessageBubble, input bar, streaming placeholder
- Implement stop/cancel generation (abort SSE + UI reset)
- Session CRUD in sidebar (rename API if missing)
- Empty state component with starter prompts
- Error/retry UI for gateway timeout and offline
- Polish tokens: spacing, typography, shadows (chat-only first)

## Done when

- Assistant answers render markdown and code blocks correctly
- User can stop generation mid-stream
- Session sidebar supports new / switch / delete / rename
- Chat usable on mobile without layout breaks
- No duplicate sends (Phase 1 behavior still holds)

## Estimated effort

**1–2 weeks**

---

# Phase 3 — Repo Identity Card

**Goal:** After ingest, user sees an auto-generated “repo profile” card with stack, summary, and stats.

## Scope

### Backend (FastAPI + Gateway)

- Extend /api/v1/persona (or build it): heuristics + LLM summary
- Fields: name, owner, URL, description, tech stack, architecture summary, purpose, key dirs, stats, suggested questions, optional license/branch
- Gateway proxy + trigger on ingest READY
- Cache in DB: personaJson on Repo or new RepoPersona model
- Refresh endpoint to regenerate

### Frontend

- RepoIdentityCard component (hero, badges, stats grid, CTA)
- Show on: ingest success, chat sidebar/top panel, /persona/[repoId]
- Loading skeleton + fallback if generation fails
- Stack-aware accent colors (Python, React, Node, etc.)

## Tasks

- Prisma migration: persona cache field(s) on Repo
- FastAPI: manifest detection (package.json, requirements.txt, go.mod, …)
- FastAPI: persona generation prompt + structured JSON response
- Gateway: GET/POST /api/repos/:id/persona, trigger after ingest complete
- Build RepoIdentityCard UI component
- Wire ingest page → show card when READY
- Wire chat page → collapsible card in sidebar
- Implement /persona/[repoId] full page
- “Refresh persona” button + cache invalidation

## Done when

- New repo reaches READY → Identity Card appears within reasonable time
- Card shows stack, summary, stats, and 3–5 suggested questions
- Persona cached; second visit loads from DB without re-generating
- Suggested questions clickable → prefill chat input (nice-to-have)

## Estimated effort

**1–2 weeks**

---

# Phase 4 — Stripe Billing & Plan Limits

**Goal:** Free / Pro (and optional Team) with enforced limits and upgrade flow.

## Scope

- Prisma: stripeCustomerId, plan, subscriptionStatus, usage counters
- Stripe Checkout (subscribe) + Customer Portal (manage/cancel)
- Gateway webhooks: checkout.session.completed, subscription.updated/deleted
- Middleware: enforce repo count + queries/day by plan
- /billing page: current plan, usage, upgrade CTA
- UI upgrade prompts when limit hit (ingest, chat)

## Tasks

- Stripe account + products/prices (Free, Pro, Team)
- Prisma schema + migration for billing fields
- POST /api/billing/checkout, POST /api/billing/portal
- POST /api/billing/webhook (raw body, signature verify)
- Plan limit middleware on repos + chat routes
- Wire /billing page
- Upgrade modals on limit errors
- Edge cases: webhook retries, downgrade mid-session, expired card

## Done when

- Free user hits repo/query limit → clear message + upgrade path
- Pro checkout completes → plan updates via webhook
- Customer Portal opens for manage/cancel
- No Stripe secrets in frontend

## Estimated effort

**1–2 weeks**

---

# Phase 5 — App-Wide Polish & Launch Readiness

**Goal:** One cohesive premium product; edge cases handled; ready to demo/ship.

## Scope

- Unify design system across landing, ingest, chat, bookmarks, persona, billing
- Shared components: cards, buttons, badges, skeletons, empty states
- Navbar + auth flows match premium look
- Accessibility: focus, ARIA, keyboard nav
- Cross-phase QA and regression tests
- Optional: connect Phase 3 suggested questions to Phase 2 empty state

## Tasks

- Audit all pages for spacing/color/type consistency
- Extract shared UI primitives if needed
- Loading/error/empty states on every major page
- Clerk sign-in/sign-up styling pass
- Full user journey test: sign in → connect repo → Identity Card → chat → bookmark → billing upgrade
- Fix any bugs found in QA
- Document env vars (Stripe, Clerk, gateway URLs)

## Done when

- All pages feel like one product (not stitched prototypes)
- Full happy path works without errors
- Duplicate chat bug still fixed
- Billing + limits + Identity Card + chat all work together

## Estimated effort

**1 week**

---

# Recommended execution order

```text
Phase 1 (fix bugs)
    ↓
Phase 2 (chat UX) ──────────────┐
    ↓                           │
Phase 3 (Identity Card) ←───────┤ can overlap after Phase 1
    ↓                           │
Phase 4 (Stripe) ←──────────────┘ start after Phase 1; wire UI in Phase 5
    ↓
Phase 5 (polish + QA)
```

## Parallel option

After Phase 1, one person can do Phase 2 (chat) while another does Phase 3 (Identity Card) or Phase 4 (Stripe backend).