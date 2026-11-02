import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalysisStatusBadge } from "@/components/analysis/analysis-status-badge";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { firstLine, readAnalysisInput, requestOf } from "@/features/analysis/input";
import { getProject, listAnalyses } from "@/features/projects/queries";
import { requireOrgContext } from "@/infrastructure/auth/session";
import { getDb } from "@/infrastructure/db/client";

export const metadata: Metadata = { title: "History" };

export default async function Page({ params, searchParams }: PageProps<"/projects/[projectId]/history">) {
  const { projectId } = await params;
  const { before } = await searchParams;
  const cursor = typeof before === "string" ? before : undefined;
  const { organizationId } = await requireOrgContext();
  const db = getDb();
  const project = await getProject(db, organizationId, projectId);
  if (!project) notFound();
  const { analyses, olderThan } = await listAnalyses(db, project.id, cursor);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-labelledby="history-heading">
        <h2 id="history-heading" className="font-medium">
          History
        </h2>
        {analyses.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nothing yet.{" "}
            <Link href={`/projects/${project.id}`} className="underline underline-offset-2">
              Draft a ticket
            </Link>{" "}
            or{" "}
            <Link href={`/projects/${project.id}/audit`} className="underline underline-offset-2">
              audit an existing one
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {analyses.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/projects/${project.id}/analyses/${a.id}`}
                  className="flex items-center gap-3 p-3 text-sm hover:bg-muted/50"
                >
                  <Badge variant="outline" className="w-14">
                    {a.kind === "create" ? "Draft" : "Audit"}
                  </Badge>
                  <span className="flex-1 truncate">{firstLine(requestOf(readAnalysisInput(a))) || "Untitled"}</span>
                  <AnalysisStatusBadge analysis={a} />
                  <span className="hidden text-muted-foreground sm:inline">
                    <LocalTime date={a.createdAt} options={{ dateStyle: "medium", timeStyle: "short" }} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {(cursor !== undefined || olderThan !== null) && (
          <nav aria-label="History pages" className="flex justify-between text-sm">
            {cursor ? (
              <Link href={`/projects/${project.id}/history`} className="underline underline-offset-2">
                Latest
              </Link>
            ) : (
              <span />
            )}
            {olderThan && (
              <Link
                href={`/projects/${project.id}/history?before=${olderThan}`}
                className="underline underline-offset-2"
              >
                Show older
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
