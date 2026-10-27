import { Skeleton } from "@/components/ui/skeleton";

// Reserved space for the project form while its connection lists load on the server.
export function ProjectFormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading connections">
      {[1, 2].map((step) => (
        <div key={step} className="flex flex-col gap-3 rounded-xl border p-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
      <Skeleton className="h-11 w-40" />
    </div>
  );
}
