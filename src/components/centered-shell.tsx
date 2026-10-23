type Props = { title: string; description?: React.ReactNode; children: React.ReactNode };

export function CenteredShell({ title, description, children }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <p className="text-center font-semibold tracking-tight">ContextLayer</p>
        <div className="flex flex-col gap-6 rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/10">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
