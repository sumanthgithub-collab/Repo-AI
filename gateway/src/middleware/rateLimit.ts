/**
 * Middleware: Rate Limiter
 * Limits each user to 20 requests/minute using Upstash Redis.
 * In local dev, uses an in-memory fallback (no Redis needed).
 *
 * Phase 4 — Week 10 implementation.
 */

import { Request, Response, NextFunction } from "express";

/**
 * rateLimiter middleware
 * Uses sliding window algorithm via Upstash Redis.
 * Returns 429 Too Many Requests when limit exceeded.
 *
 * Config:
 *   - Window: 60 seconds
 *   - Max requests: 20 per user (identified by userId from Clerk)
 *   - Falls back to IP-based limiting for unauthenticated endpoints
 */
export const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // TODO: Implement in Phase 4 - Week 10
  next(); // No-op until Week 10 — allow all in dev
};
