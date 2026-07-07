"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, LogIn, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type PublicJob = {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employmentType?: string | null;
  seniority?: string | null;
  description?: string | null;
  job_skills: { id: string; name: string; kind: string; priority: string }[];
};

export default function CandidateApplicationPage() {
  const params = useParams<{ slug: string }>();
  const { user, profile } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState(profile?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? profile?.email ?? "");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [skillsText, setSkillsText] = useState("");

  const jobQuery = trpc.job.getPublicBySlug.useQuery(
    { slug: params.slug },
    { retry: false },
  );
  const apply = trpc.job.apply.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  useEffect(() => {
    if (profile?.name && !name) setName(profile.name);
    if ((user?.email || profile?.email) && !email) {
      setEmail(user?.email ?? profile?.email ?? "");
    }
  }, [email, name, profile?.email, profile?.name, user?.email]);

  const job = jobQuery.data as PublicJob | undefined;
  const jobUnavailable = jobQuery.isError || (!job && !jobQuery.isLoading);
  const expectedSkills = useMemo(
    () => (job?.job_skills ?? []).map((skill) => skill.name),
    [job?.job_skills],
  );
  const skills = useMemo(
    () =>
      skillsText
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
    [skillsText],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply.mutate({
      slug: params.slug,
      source: user ? "SKILIO" : "GUEST",
      name,
      email,
      phone: phone || undefined,
      location: location || undefined,
      bio: bio || undefined,
      coverLetter: coverLetter || undefined,
      skills,
      links: {
        portfolio,
        linkedin,
      },
      profileSnapshot: {
        profileId: profile?.id,
        organization: profile?.organization,
      },
    });
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#eef4ec] text-[#14213d]">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/86 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7bc957] text-sm font-black text-[#0e2148] shadow-[0_12px_28px_rgba(123,201,87,0.25)]">
              S
            </div>
            <div>
              <div className="text-sm font-semibold">Skilio</div>
              <div className="text-xs text-[#66765f]">Candidate application</div>
            </div>
          </Link>
          {!user && (
            <Button asChild variant="outline" className="gap-2 rounded-xl">
              <a href={`/auth/skilio/start?next=/apply/${params.slug}`}>
                <LogIn className="h-4 w-4" />
                Login with Skilio
              </a>
            </Button>
          )}
        </div>
      </header>

      <SkilioMotionRoot className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[400px_1fr]">
        <aside className="space-y-4">
          {jobQuery.isLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : jobUnavailable ? (
            <SkilioPanel className="p-6">
              <h1 className="text-xl font-semibold">Job not available</h1>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                This application link may be closed or unpublished.
              </p>
            </SkilioPanel>
          ) : job ? (
            <SkilioPanel className="relative overflow-hidden bg-[#0e2148] p-6 text-white">
              <div
                className="absolute inset-0 opacity-25 mix-blend-luminosity"
                style={{
                  backgroundImage: "url('https://picsum.photos/seed/skilio-candidate-apply/1200/900')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_12%,rgba(123,201,87,0.34),transparent_32%),linear-gradient(180deg,rgba(14,33,72,0.76),rgba(14,33,72,0.96))]" />
              <div className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7bc957] text-[#0e2148]">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <div className="mt-5 text-sm font-medium text-[#9ee27c]">
                {job.department || "Open role"}
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal">{job.title}</h1>
              <div className="mt-3 text-sm text-white/68">
                {[job.location, job.employmentType, job.seniority].filter(Boolean).join(" / ")}
              </div>
              <p className="mt-5 whitespace-pre-line text-sm leading-6 text-white/76">
                {job.description || "Share your Skilio profile and tell us why this role fits you."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {job.job_skills.map((skill) => (
                  <Badge
                    key={skill.id}
                    variant="outline"
                    className={cn(
                      "rounded-md border-white/16",
                      skill.priority === "MUST"
                        ? "bg-[#e6f6df] text-[#24533b]"
                        : "text-white/78",
                    )}
                  >
                    {skill.name}
                  </Badge>
                ))}
              </div>
              </div>
            </SkilioPanel>
          ) : null}
        </aside>

        <SkilioPanel className="p-5 shadow-[0_28px_90px_rgba(14,33,72,0.09)]">
          {jobQuery.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : jobUnavailable ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
              <BriefcaseBusiness className="h-14 w-14 text-[#9aa89a]" />
              <h2 className="mt-5 text-2xl font-semibold">Application unavailable</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#5f6b7a]">
                This job is not accepting applications right now. Ask the employer for a current
                Skilio application link.
              </p>
            </div>
          ) : submitted ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-14 w-14 text-[#2f7d4f]" />
              <h2 className="mt-5 text-2xl font-semibold">Application submitted</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#5f6b7a]">
                Your profile has been sent to the employer. You can keep improving your Skilio
                portfolio while they review your application.
              </p>
              <Button asChild className="mt-6 rounded-xl bg-[#2f7d4f] text-white hover:bg-[#256a42]">
                <a href="https://portfolio.skilio.co/">Open Skilio portfolio</a>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-[#e6f6df] px-3 py-1 text-sm font-medium text-[#24533b]">
                  <Sparkles className="h-4 w-4" />
                  {user ? "Signed in with Skilio" : "Apply as guest or connect Skilio"}
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-[#14213d]">Your application</h2>
                <p className="mt-1 text-sm text-[#5f6b7a]">
                  Add your contact information, relevant skills, and links for the employer.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="candidate-location">Location</Label>
                  <Input
                    id="candidate-location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="portfolio">Portfolio URL</Label>
                  <Input
                    id="portfolio"
                    value={portfolio}
                    onChange={(event) => setPortfolio(event.target.value)}
                    placeholder="https://portfolio.skilio.co/username"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="linkedin">LinkedIn URL</Label>
                  <Input
                    id="linkedin"
                    value={linkedin}
                    onChange={(event) => setLinkedin(event.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="skills">Skills</Label>
                <Input
                  id="skills"
                  value={skillsText}
                  onChange={(event) => setSkillsText(event.target.value)}
                  placeholder={expectedSkills.slice(0, 5).join(", ") || "Communication, React, SQL"}
                  className="mt-2"
                />
                <p className="mt-2 text-xs text-[#66765f]">Separate skills with commas.</p>
              </div>

              <div>
                <Label htmlFor="bio">Profile summary</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  className="mt-2 min-h-28"
                />
              </div>

              <div>
                <Label htmlFor="cover">Cover note</Label>
                <Textarea
                  id="cover"
                  value={coverLetter}
                  onChange={(event) => setCoverLetter(event.target.value)}
                  className="mt-2 min-h-36"
                />
              </div>

              <Button
                type="submit"
                disabled={apply.isLoading || !job}
                className="w-full gap-2 rounded-xl bg-[#2f7d4f] text-white hover:bg-[#256a42]"
              >
                Submit application
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}
        </SkilioPanel>
      </SkilioMotionRoot>
    </main>
  );
}
