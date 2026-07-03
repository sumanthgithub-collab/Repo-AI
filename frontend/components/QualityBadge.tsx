/**
 * Component: QualityBadge
 * Displays the RAGAS score for an answer as a colored badge.
 *
 * Props:
 *   faithfulness:    number  — 0.0 to 1.0
 *   answerRelevancy: number  — 0.0 to 1.0
 *   overall:         "high" | "medium" | "low"
 *
 * Colors:
 *   high   (avg > 0.8) → Green
 *   medium (0.6–0.8)   → Yellow
 *   low    (< 0.6)     → Red
 *
 * Phase 2 — Week 6 implementation.
 */

interface QualityBadgeProps {
  faithfulness?: number;
  answerRelevancy?: number;
  overall: "high" | "medium" | "low";
}

// TODO: Phase 2 Week 6 — full styled badge with tooltip showing individual scores
export default function QualityBadge({ overall }: QualityBadgeProps) {
  const colors = { high: "green", medium: "yellow", low: "red" };
  return <span style={{ color: colors[overall] }}>Score: {overall}</span>;
}
