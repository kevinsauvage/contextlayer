import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg aria-hidden viewBox="0 0 20 20" className="size-5 text-brand">
        <path d="M10 2.5 17.5 6.5 10 10.5 2.5 6.5Z" fill="currentColor" />
        <path
          d="m2.5 10 7.5 4 7.5-4M2.5 13.5l7.5 4 7.5-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
      </svg>
      ContextLayer
    </span>
  );
}
