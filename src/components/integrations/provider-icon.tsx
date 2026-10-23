import { FolderGit2, SquareKanban, type LucideProps } from "lucide-react";
import type { ProviderKind } from "@/core/integrations/provider";

export function ProviderIcon({ kind, ...props }: { kind: ProviderKind } & LucideProps) {
  const Icon = kind === "source" ? FolderGit2 : SquareKanban;
  return <Icon aria-hidden {...props} />;
}
