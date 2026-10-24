import type { ClaimStatus } from "@/core/evidence/schemas";
import { CLAIM_STATUS_LABELS } from "@/core/evidence/schemas";
import { Badge } from "@/components/ui/badge";

const VARIANTS: Record<ClaimStatus, "success" | "info" | "outline" | "warning"> = {
  verified: "success",
  inferred: "info",
  unknown: "outline",
  needs_clarification: "warning",
};

export const ClaimStatusBadge = ({ status }: { status: ClaimStatus }) => (
  <Badge variant={VARIANTS[status]}>{CLAIM_STATUS_LABELS[status]}</Badge>
);
