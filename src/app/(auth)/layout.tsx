import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="skilio-interface relative grid min-h-screen overflow-hidden bg-[var(--skilio-canvas)] lg:grid-cols-[minmax(0,1fr)_520px]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-[var(--skilio-border)] bg-[var(--skilio-canvas)] p-10 text-[var(--skilio-ink)] lg:flex lg:flex-col lg:justify-between">
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[var(--skilio-radius-md)] bg-[var(--skilio-elevated)] shadow-[var(--skilio-shadow-1)]">
            <Image src="/logos/skilio-leaf-square.png" alt="Skilio" width={36} height={36} className="h-9 w-9 object-contain" />
          </div>
          <div>
            <div className="font-semibold">Skilio Hiring</div>
            <div className="text-sm text-[var(--skilio-ink-muted)]">Employer hiring portal</div>
          </div>
        </div>
        <div className="relative max-w-3xl rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-panel)] p-6 shadow-[var(--skilio-shadow-1)]">
          <div className="absolute inset-y-0 left-0 w-1 bg-[var(--skilio-signal)]" />
          <h1 className="max-w-4xl pl-3 text-[clamp(2.1rem,3.6vw,3.6rem)] font-semibold leading-[1.04] tracking-[-0.01em]">
            Hire from verified profiles.
          </h1>
          <p className="mt-4 max-w-2xl pl-3 text-[15px] leading-7 text-[var(--skilio-ink-soft)]">
            Publish roles, route candidates through Skilio, and keep applicant signals close to portfolio evidence.
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-3">
          {["Jobs", "Applicants", "Portfolio"].map((item) => (
            <div key={item} className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-elevated)] p-4 shadow-[var(--skilio-shadow-1)]">
              <div className="text-sm font-medium text-[var(--skilio-ink)]">{item}</div>
              <div className="mt-2 h-1.5 rounded-full bg-[var(--skilio-signal)]" />
            </div>
          ))}
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </div>
  );
}
