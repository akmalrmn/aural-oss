export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative grid min-h-screen overflow-hidden bg-[#eef4ec] lg:grid-cols-[minmax(0,1fr)_520px]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#0e2148] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 opacity-35 mix-blend-luminosity"
          style={{
            backgroundImage: "url('https://picsum.photos/seed/skilio-auth-console/1920/1280')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_14%,rgba(123,201,87,0.42),transparent_30%),linear-gradient(180deg,rgba(14,33,72,0.64),rgba(14,33,72,0.96))]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7bc957] font-black text-[#0e2148]">
            S
          </div>
          <div>
            <div className="font-semibold">Skilio Assessment</div>
            <div className="text-sm text-white/58">Employer hiring portal</div>
          </div>
        </div>
        <div className="relative max-w-3xl">
          <h1 className="max-w-5xl text-[clamp(2.75rem,4.2vw,4.65rem)] font-semibold leading-[1] tracking-normal">
            Hire from verified profiles, not scattered spreadsheets.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72">
            Publish roles, route candidates through Skilio, and keep applicant signals close to the portfolio evidence.
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-3">
          {["Jobs", "Applicants", "Portfolio"].map((item) => (
            <div key={item} className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur">
              <div className="text-sm font-medium">{item}</div>
              <div className="mt-2 h-1.5 rounded-full bg-[#7bc957]" />
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
