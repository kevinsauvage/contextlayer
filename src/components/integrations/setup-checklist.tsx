import { CircleCheck, Circle } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Step = { done: boolean; title: string; description: string; href: Route; cta: string };

export function SetupChecklist({ steps, isAdmin }: { steps: Step[]; isAdmin: boolean }) {
  const next = steps.findIndex((step) => !step.done);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Get set up</CardTitle>
        <CardDescription>
          {isAdmin
            ? "Three steps to your first evidence-backed ticket."
            : "An organization owner or admin needs to finish these steps before you can analyze tickets."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-1">
          {steps.map((step, index) => {
            const Icon = step.done ? CircleCheck : Circle;
            return (
              <li
                key={step.title}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5",
                  index === next && "bg-brand/6 ring-1 ring-brand/15",
                )}
                aria-current={index === next ? "step" : undefined}
              >
                <Icon
                  aria-hidden
                  className={cn("size-5 shrink-0", step.done ? "text-success" : "text-muted-foreground")}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("font-medium", step.done && "text-muted-foreground line-through")}>
                    {step.title}
                  </span>
                  <span className="text-sm text-muted-foreground">{step.description}</span>
                </div>
                {isAdmin && index === next && (
                  <Link href={step.href} className={buttonVariants({ size: "sm" })}>
                    {step.cta}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
