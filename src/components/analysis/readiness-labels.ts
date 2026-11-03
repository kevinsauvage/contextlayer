import type { DraftReadiness } from "@/core/requirements/readiness";
import { countLabel } from "@/lib/count";

export const readinessLabels = ({ openQuestions, needsClarification }: DraftReadiness): string[] => [
  ...(openQuestions ? [countLabel(openQuestions, "open question", "open questions")] : []),
  ...(needsClarification
    ? [countLabel(needsClarification, "claim needs clarification", "claims need clarification")]
    : []),
];
