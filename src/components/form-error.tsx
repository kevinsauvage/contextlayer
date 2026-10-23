import { cn } from "@/lib/utils";

export function FormError({ error, id, className }: { error?: string; id?: string; className?: string }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className={cn("text-sm text-destructive", className)}>
      {error}
    </p>
  );
}
