import Image from "next/image";
import { ArrowRight, BriefcaseBusiness, FolderCheck, Users } from "lucide-react";

const workflow = [
  { label: "Jobs", icon: BriefcaseBusiness },
  { label: "Applicants", icon: Users },
  { label: "Portfolio evidence", icon: FolderCheck },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="skilio-interface relative grid min-h-[100svh] overflow-hidden bg-[var(--skilio-canvas)] lg:grid-cols-[minmax(0,1fr)_minmax(460px,36vw)]">
      <section className="relative hidden min-h-[100svh] border-r border-[var(--skilio-border)] px-10 py-8 text-[var(--skilio-ink)] lg:grid lg:grid-rows-[auto_1fr_auto] xl:px-14 xl:py-12">
        <header className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[var(--skilio-radius-md)] bg-[var(--skilio-elevated)] shadow-[var(--skilio-shadow-1)]">
            <Image
              src="/logos/skilio-leaf-square.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              priority
            />
          </div>
          <div>
            <div className="font-semibold">Skilio Hiring</div>
            <div className="text-sm text-[var(--skilio-ink-muted)]">Employer hiring portal</div>
          </div>
        </header>

        <div className="flex max-w-3xl self-center">
          <div>
            <h2 className="max-w-[12ch] text-[clamp(2.35rem,4.4vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.025em]">
              Hire from verified profiles.
            </h2>
            <p className="mt-6 max-w-[56ch] text-base leading-7 text-[var(--skilio-ink-soft)]">
              Publish roles, route candidates through Skilio, and keep applicant signals close to portfolio evidence.
            </p>

            <ol
              aria-label="Hiring workflow"
              className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-4 text-sm font-medium text-[var(--skilio-ink)]"
            >
              {workflow.map(({ label, icon: Icon }, index) => (
                <li key={label} className="flex items-center gap-3">
                  {index > 0 && (
                    <ArrowRight
                      className="h-4 w-4 text-[var(--skilio-ink-muted)]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <p className="text-xs leading-5 text-[var(--skilio-ink-muted)]">
          One Skilio workspace for employer hiring operations.
        </p>
      </section>

      <main className="flex min-h-[100svh] items-center justify-center bg-[var(--skilio-panel)] px-4 py-6 sm:px-8 sm:py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
