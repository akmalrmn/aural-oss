"use client";

import { cn } from "@/lib/utils";

type Metric = {
  label: string;
  value: string | number;
  detail?: string;
};

export function EmployerPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header
      data-skillio-reveal
      className="flex flex-col gap-5 border-b border-[var(--skilio-border)] pb-6 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <h1 className="font-heading text-3xl font-semibold leading-tight text-[var(--skilio-ink)] sm:text-4xl">
          {title}
        </h1>
        <div className="mt-2 max-w-2xl text-sm leading-6 text-[var(--skilio-ink-soft)] sm:text-[15px]">
          {description}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmployerMetricStrip({
  metrics,
  className,
}: {
  metrics: Metric[];
  className?: string;
}) {
  return (
    <section
      data-skillio-reveal
      aria-label="Workspace summary"
      className="overflow-hidden rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-border)] shadow-[var(--skilio-shadow-1)]"
    >
      <div className={cn("grid grid-cols-2 gap-px md:grid-cols-4", className)}>
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 bg-[var(--skilio-elevated)] px-4 py-4 sm:px-5"
          >
            <div className="text-xs font-medium text-[var(--skilio-ink-muted)]">
              {metric.label}
            </div>
            <div className="mt-1 font-heading text-2xl font-semibold tabular-nums text-[var(--skilio-ink)]">
              {metric.value}
            </div>
            {metric.detail && (
              <div className="mt-1 truncate text-xs text-[var(--skilio-ink-muted)]">
                {metric.detail}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
