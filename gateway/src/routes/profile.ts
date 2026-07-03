/**
 * Route: /api/profile
 * User profile and settings management.
 *
 * Phase 4 — Week 10 implementation.
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth";

export const profileRoutes = Router();

/**
 * GET /api/profile
 * Get current user profile + Clerk data + usage stats.
 */
profileRoutes.get("/", requireAuth, async (req, res) => {
  // TODO: Phase 4 Week 10
  res.status(501).json({ error: "Not implemented — Phase 4 Week 10" });
});

/**
 * GET /api/profile/usage
 * Return rate limit status, query count, repos connected.
 */
profileRoutes.get("/usage", requireAuth, async (req, res) => {
  // TODO: Phase 4 Week 10
  res.status(501).json({ error: "Not implemented — Phase 4 Week 10" });
});
