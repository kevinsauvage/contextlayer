import type { ClaimStatus } from "@/core/evidence/schemas";
import { Badge } from "@/components/ui/badge";

const LABELS: Record<ClaimStatus, string> = {
  verified: "Verified",
  inferred: "Inferred",
  unknown: "Unknown",
  needs_clarification: "Needs clarification",
};

const VARIANTS: Record<ClaimStatus, "default" | "secondary" | "outline" | "destructive"> = {
  verified: "default",
  inferred: "secondary",
  unknown: "outline",
  needs_clarification: "destructive",
};

export const StatusBadge = ({ status }: { status: ClaimStatus }) => <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
