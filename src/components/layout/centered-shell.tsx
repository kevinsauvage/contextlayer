import { Logo } from "@/components/layout/logo";

type Props = { title: string; description?: React.ReactNode; children: React.ReactNode };

export function CenteredShell({ title, description, children }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Logo className="self-center text-lg" />
        <div className="flex flex-col gap-6 rounded-2xl bg-card p-7 shadow-raised ring-1 ring-foreground/8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold tracking-[-0.015em]">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
