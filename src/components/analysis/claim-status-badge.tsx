import type { ClaimStatus } from "@/core/evidence/schemas";
import { CLAIM_STATUS_LABELS } from "@/core/evidence/schemas";
import { Badge } from "@/components/ui/badge";

const VARIANTS: Record<ClaimStatus, "default" | "secondary" | "outline" | "destructive"> = {
  verified: "default",
  inferred: "secondary",
  unknown: "outline",
  needs_clarification: "destructive",
};

export const ClaimStatusBadge = ({ status }: { status: ClaimStatus }) => (
  <Badge variant={VARIANTS[status]}>{CLAIM_STATUS_LABELS[status]}</Badge>
);
