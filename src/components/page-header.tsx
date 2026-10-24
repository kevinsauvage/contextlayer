type Props = {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, breadcrumb, actions }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {breadcrumb && (
        <nav
          aria-label="Breadcrumb"
          className="text-sm text-muted-foreground [&_a]:transition-colors [&_a:hover]:text-foreground"
        >
          {breadcrumb}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.025em]">{title}</h1>
          {description && <div className="max-w-prose text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
