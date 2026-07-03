import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { rateLimiter } from "../middleware/rateLimit";
import { aiClient } from "../services/aiProxy";

export const prRoutes = Router();

const SummarizeSchema = z.object({
  prUrl: z.string().url(),
  repoId: z.string().optional(),
});

prRoutes.post("/summarize", requireAuth, rateLimiter, async (req, res) => {
  const parse = SummarizeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0].message });
    return;
  }

  const response = await aiClient.post("/api/v1/pr/summarize", {
    pr_url: parse.data.prUrl,
    repo_id: parse.data.repoId ?? "standalone",
  });

  res.json({
    summary: response.data.summary,
    impactWarnings: response.data.impact_warnings ?? [],
    changedFunctions: response.data.changed_functions ?? [],
    diffOverview: response.data.diff_overview,
  });
});
