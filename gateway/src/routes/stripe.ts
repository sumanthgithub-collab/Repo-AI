/**
 * Route: /api/stripe
 * Stripe billing — checkout, webhook, portal.
 *
 * Requires env vars:
 *   STRIPE_SECRET_KEY         — sk_test_... or sk_live_...
 *   STRIPE_WEBHOOK_SECRET     — whsec_... from Stripe CLI or dashboard
 *   STRIPE_PRO_PRICE_ID       — price_...  for Pro Monthly plan
 *   STRIPE_TEAM_PRICE_ID      — price_...  for Team Monthly plan
 *   NEXT_PUBLIC_APP_URL       — https://yourdomain.com (for redirects)
 */

import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { requireAuth } from "../middleware/auth";
import { prisma, ensureUser } from "../services/db";

export const stripeRoutes = Router();

// ── Stripe singleton ───────────────────────────────────────────────────────────

function getStripe(): any {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith("sk_test_your")) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key);
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ── Plan config ────────────────────────────────────────────────────────────────

const PLANS: Record<string, { priceId: string; name: string }> = {
  pro: {
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    name: "RepoTalk Pro",
  },
  team: {
    priceId: process.env.STRIPE_TEAM_PRICE_ID || "",
    name: "RepoTalk Team",
  },
};

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session and returns the URL.
 */
stripeRoutes.post("/checkout", requireAuth, async (req, res) => {
  const { plan } = req.body as { plan?: string };
  if (!plan || !PLANS[plan]) {
    res.status(400).json({ error: "Invalid plan. Choose 'pro' or 'team'." });
    return;
  }

  const userId = await ensureUser(req.userId!, req.userEmail);

  // Fetch or create Stripe customer
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let stripe: any;
  try {
    stripe = getStripe();
  } catch {
    res.status(503).json({ error: "Stripe is not configured on this server" });
    return;
  }

  let customerId = user.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
    success_url: `${APP_URL}/billing?success=true&plan=${plan}`,
    cancel_url: `${APP_URL}/pricing?canceled=true`,
    metadata: { userId, plan },
    subscription_data: {
      metadata: { userId, plan },
    },
    allow_promotion_codes: true,
  });

  res.json({ url: session.url });
});

/**
 * POST /api/stripe/portal
 * Creates a Stripe Billing Portal session.
 */
stripeRoutes.post("/portal", requireAuth, async (req, res) => {
  const userId = await ensureUser(req.userId!, req.userEmail);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    res.status(400).json({ error: "No billing account found. Subscribe to a plan first." });
    return;
  }

  let stripe: any;
  try {
    stripe = getStripe();
  } catch {
    res.status(503).json({ error: "Stripe is not configured on this server" });
    return;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${APP_URL}/billing`,
  });

  res.json({ url: session.url });
});

/**
 * GET /api/stripe/status
 * Returns the current user's subscription plan.
 */
stripeRoutes.get("/status", requireAuth, async (req, res) => {
  const userId = await ensureUser(req.userId!, req.userEmail);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      planExpiresAt: true,
      subscription: {
        select: {
          status: true,
          plan: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      },
    },
  });

  res.json({
    plan: user?.plan ?? "free",
    planExpiresAt: user?.planExpiresAt ?? null,
    subscription: user?.subscription ?? null,
  });
});

/**
 * POST /api/stripe/webhook
 * Stripe webhook handler — syncs subscription state to DB.
 * Raw body required (Express JSON middleware must NOT parse this route).
 */
stripeRoutes.post(
  "/webhook",
  async (req: Request, res: Response) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let stripe: any;
    try {
      stripe = getStripe();
    } catch {
      res.status(503).json({ error: "Stripe not configured" });
      return;
    }

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        req.headers["stripe-signature"] as string,
        webhookSecret || ""
      );
    } catch {
      res.status(400).json({ error: "Webhook signature verification failed" });
      return;
    }

    const data = event.data.object as any;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        if (userId && plan) {
          await prisma.user.update({
            where: { id: userId },
            data: { plan, planExpiresAt: null },
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = data;
        const userId = sub.metadata?.userId;
        const plan = sub.metadata?.plan || "pro";
        if (!userId) break;

        await prisma.subscription.upsert({
          where: { stripeSubscriptionId: sub.id },
          create: {
            userId,
            stripeSubscriptionId: sub.id,
            stripePriceId: (sub.items.data[0]?.price?.id) ?? "",
            stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "",
            status: sub.status,
            plan,
            currentPeriodStart: new Date((sub as unknown as { current_period_start: number }).current_period_start * 1000),
            currentPeriodEnd: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          },
          update: {
            status: sub.status,
            currentPeriodStart: new Date((sub as unknown as { current_period_start: number }).current_period_start * 1000),
            currentPeriodEnd: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          },
        });

        // Sync plan on user
        if (sub.status === "active" || sub.status === "trialing") {
          await prisma.user.update({
            where: { id: userId },
            data: { plan },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = data;
        const userId = sub.metadata?.userId;
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: { plan: "free", planExpiresAt: new Date() },
          });
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: sub.id },
            data: { status: "canceled" },
          });
        }
        break;
      }
    }

    res.json({ received: true });
  }
);
