/**
 * Gateway: Clerk JWT Authentication Middleware
 *
 * - Verifies Clerk session token from Authorization: Bearer <token>
 * - Attaches req.userId (Clerk user ID string) for downstream handlers
 *
 * Dev bypass: if CLERK_SECRET_KEY is not set or set to placeholder,
 * middleware accepts any request and sets userId = "dev-user-001".
 * This lets you develop without a real Clerk account.
 */

import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

const DEV_BYPASS =
  !process.env.CLERK_SECRET_KEY ||
  process.env.CLERK_SECRET_KEY.startsWith("sk_test_your_clerk");

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // ── Dev bypass ─────────────────────────────────────────────────────────────
  if (DEV_BYPASS) {
    req.userId = "dev-user-001";
    req.userEmail = "dev@repotalk.local";
    return next();
  }

  // ── Verify Clerk JWT ───────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    req.userId = payload.sub;
    // email may be in sessionClaims depending on Clerk template
    req.userEmail =
      (payload as Record<string, unknown>).email as string | undefined;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
