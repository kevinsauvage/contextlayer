type Variant = "default" | "muted";

export function Badge({ children, variant = "default" }: { children: string; variant?: Variant }) {
  return <span className={variant === "muted" ? "badge badge-muted" : "badge"}>{children}</span>;
}
