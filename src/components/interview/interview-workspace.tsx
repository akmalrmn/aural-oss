import { cn } from "@/lib/utils";

export function InterviewWorkspace({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "mx-auto flex w-full max-w-7xl flex-col gap-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function InterviewWorkspaceHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="max-w-4xl font-heading text-[clamp(1.75rem,3vw,2.6rem)] font-semibold leading-[1.04] tracking-[-0.01em] text-[var(--skilio-ink)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[70ch] text-sm leading-6 text-[var(--skilio-ink-soft)] sm:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function InterviewWorkspaceToolbar({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "flex flex-col gap-3 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-panel)] p-3 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function InterviewWorkspaceSurface({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "overflow-hidden rounded-[var(--skilio-radius-lg)] bg-[var(--skilio-elevated)] shadow-[var(--skilio-shadow-1)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
