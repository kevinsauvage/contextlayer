import Link from "next/link";
import { CenteredShell } from "@/components/layout/centered-shell";

export default function NotFound() {
  return (
    <CenteredShell
      title="Page not found"
      description="It may have been deleted, or it belongs to another organization."
    >
      <Link href="/projects" className="text-sm underline">
        Back to projects
      </Link>
    </CenteredShell>
  );
}
