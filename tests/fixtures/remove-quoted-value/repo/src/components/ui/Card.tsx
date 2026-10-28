export const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-zinc-700 p-6">{children}</div>
);

export const CardHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4 flex flex-col gap-1">{children}</div>
);
