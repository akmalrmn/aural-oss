"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  FileCheck2,
  Github,
  Link2,
  Linkedin,
  LogIn,
  Plus,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApplicationDrawingAssessment } from "@/components/drawing/application-drawing-assessment";
import { SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import {
  DRAWING_STARTER_SHAPES,
  type ApplicationDrawingResponse,
} from "@/lib/drawing-assessment";
import type { Json } from "@/lib/supabase/types";

type PublicJob = {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employmentType?: string | null;
  seniority?: string | null;
  description?: string | null;
  job_skills: { id: string; name: string; kind: string; priority: string }[];
  screeningQuestions?: {
    id: string;
    prompt: string;
    type: "TEXT" | "YES_NO" | "SELECT";
    required: boolean;
    options: string[];
  }[];
};

type AuthChoice = "skilio" | "guest";

const steps = [
  "Access",
  "Profile",
  "Drawmetrics",
  "Skills",
  "Portfolio",
  "Pre-screening",
  "Review",
] as const;

const profileUrl = "https://portfolio.skilio.co/";

const countries = [
  "Australia",
  "Canada",
  "China",
  "France",
  "Germany",
  "Hong Kong",
  "India",
  "Indonesia",
  "Japan",
  "Malaysia",
  "Netherlands",
  "New Zealand",
  "Philippines",
  "Singapore",
  "South Korea",
  "Spain",
  "Thailand",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Vietnam",
  "Other",
] as const;

const phoneCountryCodes = [
  ["+1", "US / Canada"],
  ["+33", "France"],
  ["+44", "United Kingdom"],
  ["+49", "Germany"],
  ["+60", "Malaysia"],
  ["+61", "Australia"],
  ["+62", "Indonesia"],
  ["+63", "Philippines"],
  ["+65", "Singapore"],
  ["+66", "Thailand"],
  ["+81", "Japan"],
  ["+82", "South Korea"],
  ["+84", "Vietnam"],
  ["+86", "China"],
  ["+91", "India"],
  ["+971", "UAE"],
] as const;

function normalizeSkill(skill: string) {
  return skill.trim().toLowerCase();
}

function cleanOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function cleanOptionalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function asRecord(value: Json | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: Json | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return "";
}

function getCvAttachment(profile: Record<string, unknown>) {
  const cv = asRecord(profile.cv as Json | undefined);
  const filename = firstNonEmpty(cv.filename);
  const url = firstNonEmpty(cv.url);
  return filename || url ? { filename, url } : null;
}

function getSkillEvidence(profile: Record<string, unknown>) {
  const evidence = profile.skillEvidence;
  return Array.isArray(evidence) ? (evidence as Record<string, unknown>[]) : [];
}

function summarizePortfolioEvidence(skill: string, evidence: Record<string, unknown>[]) {
  const item = evidence.find(
    (entry) => normalizeSkill(asString(entry.name)) === normalizeSkill(skill),
  );
  if (!item) return "";

  const proofs = Array.isArray(item.proofs) ? (item.proofs as Record<string, unknown>[]) : [];
  const videos = Array.isArray(item.videos) ? (item.videos as Record<string, unknown>[]) : [];
  const proofLabels = proofs
    .map((proof) => firstNonEmpty(proof.description, proof.fileName, proof.url, proof.fileUrl))
    .filter(Boolean)
    .slice(0, 3);
  const videoLabels = videos
    .map((video) => firstNonEmpty(video.title, video.fileName, video.url))
    .filter(Boolean)
    .slice(0, 2);
  const details = [
    firstNonEmpty(item.proficiency) && `Proficiency: ${firstNonEmpty(item.proficiency)}`,
    typeof item.yearsOfExperience === "number" && `Experience: ${item.yearsOfExperience} years`,
    proofLabels.length && `Proofs: ${proofLabels.join("; ")}`,
    videoLabels.length && `Videos: ${videoLabels.join("; ")}`,
  ].filter(Boolean);

  return details.join("\n");
}

function StepRail({ current }: { current: number }) {
  return (
    <nav
      aria-label="Application progress"
      className="overflow-x-auto rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-panel)] px-3 py-4 shadow-[var(--skilio-shadow-1)]"
    >
      <div className="grid min-w-[700px] grid-cols-7">
        {steps.map((step, index) => {
          const state = index < current ? "done" : index === current ? "active" : "idle";
          return (
            <div
              key={step}
              aria-current={state === "active" ? "step" : undefined}
              className="relative flex min-w-0 flex-col items-center px-1 text-center"
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute right-1/2 top-[15px] h-px w-full",
                    index <= current
                      ? "bg-[var(--skilio-brand)]"
                      : "bg-[var(--skilio-border-strong)]",
                  )}
                />
              )}
              <span
                data-testid="application-step-marker"
                className={cn(
                  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--skilio-radius-md)] border text-xs font-semibold tabular-nums",
                  state === "active" &&
                    "border-[var(--skilio-brand)] bg-[var(--skilio-brand)] text-white",
                  state === "done" &&
                    "border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]",
                  state === "idle" &&
                    "border-[var(--skilio-border-strong)] bg-[var(--skilio-panel)] text-[var(--skilio-ink-muted)]",
                )}
              >
                {state === "done" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "mt-2 min-h-8 text-xs font-medium leading-4",
                  state === "active"
                    ? "text-[var(--skilio-brand-strong)]"
                    : state === "done"
                      ? "text-[var(--skilio-ink)]"
                      : "text-[var(--skilio-ink-muted)]",
                )}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function JobSummaryCard({
  job,
  loading,
  unavailable,
}: {
  job?: PublicJob;
  loading: boolean;
  unavailable: boolean;
}) {
  if (loading) return <Skeleton className="h-80 w-full" />;
  if (unavailable || !job) {
    return (
      <SkilioPanel className="p-6">
        <h1 className="text-xl font-semibold">Job not available</h1>
        <p className="mt-2 text-sm text-[var(--skilio-ink-soft)]">
          This application link may be closed or unpublished.
        </p>
      </SkilioPanel>
    );
  }

  return (
    <SkilioPanel className="relative overflow-hidden bg-[var(--skilio-ink)] p-6 text-white">
      <div className="absolute inset-y-0 left-0 w-1 bg-[var(--skilio-signal)]" />
      <div className="relative">
        <div className="flex h-11 w-11 items-center justify-center rounded-[var(--skilio-radius-md)] bg-[var(--skilio-signal)] text-[var(--skilio-ink)]">
          <BriefcaseBusiness className="h-5 w-5" />
        </div>
        <div className="mt-5 text-sm font-medium text-[var(--skilio-signal)]">
          {job.department || "Open role"}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">{job.title}</h1>
        <div className="mt-3 text-sm text-white/68">
          {[job.location, job.employmentType, job.seniority].filter(Boolean).join(" / ")}
        </div>
        <details className="mt-5 border-t border-white/15 pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">
            Job description
          </summary>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white/76">
            {job.description || "Share your Skilio profile and tell us why this role fits you."}
          </p>
        </details>
        <div className="mt-5 flex flex-wrap gap-2">
          {job.job_skills.map((skill) => (
            <Badge
              key={skill.id}
              variant="outline"
              className={cn(
                "rounded-md border-white/16",
                skill.priority === "MUST"
                  ? "bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]"
                  : "text-white/78",
              )}
            >
              {skill.name}
            </Badge>
          ))}
        </div>
      </div>
    </SkilioPanel>
  );
}

export default function CandidateApplicationPage() {
  const params = useParams<{ slug: string }>();
  const { user, profile, skilioIdentity, loading: authLoading } = useAuth();
  const submittingRef = useRef(false);
  const appliedSkilioSkillsRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0);
  const [authChoice, setAuthChoice] = useState<AuthChoice | null>(null);
  const [name, setName] = useState(profile?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? profile?.email ?? "");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+60");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [website, setWebsite] = useState("");
  const [customSkill, setCustomSkill] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillEvidence, setSkillEvidence] = useState<Record<string, string>>({});
  const [screeningAnswers, setScreeningAnswers] = useState<
    Record<string, string>
  >({});
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [drawingResponses, setDrawingResponses] = useState<
    ApplicationDrawingResponse[]
  >([]);

  const jobQuery = trpc.job.getPublicBySlug.useQuery(
    { slug: params.slug },
    { retry: false },
  );
  const apply = trpc.job.apply.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setStep(steps.length - 1);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    },
    onSettled: () => {
      submittingRef.current = false;
    },
  });

  const job = jobQuery.data as PublicJob | undefined;
  const jobUnavailable = jobQuery.isError || (!job && !jobQuery.isLoading);
  const expectedSkills = useMemo(
    () => (job?.job_skills ?? []).map((skill) => skill.name),
    [job?.job_skills],
  );
  const skilioProfileSnapshot = useMemo(
    () => asRecord(skilioIdentity?.profileSnapshot),
    [skilioIdentity?.profileSnapshot],
  );
  const skilioSkills = useMemo(
    () => asStringArray(skilioIdentity?.skillsSnapshot),
    [skilioIdentity?.skillsSnapshot],
  );
  const skilioCv = useMemo(
    () => getCvAttachment(skilioProfileSnapshot),
    [skilioProfileSnapshot],
  );
  const skilioSkillEvidence = useMemo(
    () => getSkillEvidence(skilioProfileSnapshot),
    [skilioProfileSnapshot],
  );

  useEffect(() => {
    if (!user) return;

    if (!authChoice) setAuthChoice("skilio");

    const nextName = firstNonEmpty(skilioIdentity?.name, profile?.name);
    if (nextName && !name) setName(nextName);

    const nextEmail = firstNonEmpty(user.email, skilioIdentity?.email, profile?.email);
    if (nextEmail && !email) setEmail(nextEmail);

    const nextPhone = asString(skilioProfileSnapshot.phoneNumber);
    if (nextPhone && !phone) setPhone(nextPhone);

    const nextPhoneCountryCode = asString(
      skilioProfileSnapshot.phoneCountryCode,
    );
    if (nextPhoneCountryCode) setPhoneCountryCode(nextPhoneCountryCode);

    const nextLocation = firstNonEmpty(skilioProfileSnapshot.country);
    if (nextLocation && !location) setLocation(nextLocation);

    const nextPortfolio = firstNonEmpty(skilioProfileSnapshot.publicUrl);
    if (nextPortfolio && !portfolio) setPortfolio(nextPortfolio);

    if (skilioCv?.filename && !resumeFileName) setResumeFileName(skilioCv.filename);
    if (skilioCv?.url && !resumeUrl) setResumeUrl(skilioCv.url);
  }, [
    authChoice,
    email,
    location,
    name,
    phone,
    portfolio,
    profile?.email,
    profile?.name,
    resumeFileName,
    resumeUrl,
    skilioCv?.filename,
    skilioCv?.url,
    skilioIdentity?.email,
    skilioIdentity?.name,
    skilioProfileSnapshot,
    user,
  ]);

  useEffect(() => {
    if (appliedSkilioSkillsRef.current || skilioSkills.length === 0) return;
    appliedSkilioSkillsRef.current = true;

    const roleSkills = expectedSkills.length
      ? expectedSkills.filter((skill) =>
          skilioSkills.some((candidateSkill) => normalizeSkill(candidateSkill) === normalizeSkill(skill)),
        )
      : [];
    const seeded = [...roleSkills, ...skilioSkills, ...selectedSkills]
      .filter((skill, index, all) => all.findIndex((item) => normalizeSkill(item) === normalizeSkill(skill)) === index)
      .slice(0, 12);

    if (seeded.length) {
      setSelectedSkills(seeded);
      setSkillEvidence((current) => ({
        ...Object.fromEntries(
          seeded.map((skill) => {
            const portfolioEvidence = summarizePortfolioEvidence(skill, skilioSkillEvidence);
            return [skill, current[skill] || portfolioEvidence];
          }),
        ),
      }));
    }
  }, [expectedSkills, selectedSkills, skilioSkillEvidence, skilioSkills]);

  const applyingWithSkilio = Boolean(user && (authChoice === "skilio" || authChoice === null));
  const applyingManually = authChoice === "guest";
  const currentStep = step;
  const hasCandidateEmail = /\S+@\S+\.\S+/.test(email);
  const drawingStatusQuery = trpc.job.getDrawingAssessmentStatus.useQuery(
    {
      email: hasCandidateEmail ? email.trim() : undefined,
      portfolioUserId: skilioIdentity?.portfolioUserId ?? undefined,
      identityLinkId: skilioIdentity?.id ?? undefined,
    },
    {
      enabled:
        currentStep >= 2 &&
        Boolean(
          hasCandidateEmail ||
            skilioIdentity?.portfolioUserId ||
            skilioIdentity?.id,
        ),
      retry: false,
      staleTime: 60_000,
    },
  );
  const reusableDrawingStatus =
    drawingStatusQuery.data?.reusable === true
      ? drawingStatusQuery.data
      : null;
  const canReuseDrawingAssessment = Boolean(reusableDrawingStatus);
  const hasCompleteDrawingAssessment =
    drawingResponses.length === DRAWING_STARTER_SHAPES.length;

  const canContinue = useMemo(() => {
    if (submitted) return false;
    if (currentStep === 0) return !authLoading && (applyingWithSkilio || applyingManually);
    if (currentStep === 1) return name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email);
    if (currentStep === 2) {
      return (
        !drawingStatusQuery.isLoading &&
        (canReuseDrawingAssessment || hasCompleteDrawingAssessment)
      );
    }
    if (currentStep === 3) return selectedSkills.length > 0;
    if (currentStep === 4) return true;
    if (currentStep === 5) {
      return (job?.screeningQuestions ?? [])
        .filter((question) => question.required)
        .every((question) => screeningAnswers[question.id]?.trim());
    }
    return true;
  }, [
    applyingManually,
    applyingWithSkilio,
    authLoading,
    canReuseDrawingAssessment,
    drawingStatusQuery.isLoading,
    email,
    hasCompleteDrawingAssessment,
    job?.screeningQuestions,
    name,
    screeningAnswers,
    selectedSkills.length,
    currentStep,
    submitted,
  ]);

  function toggleSkill(skill: string) {
    setSelectedSkills((current) => {
      if (current.some((item) => normalizeSkill(item) === normalizeSkill(skill))) {
        const next = current.filter((item) => normalizeSkill(item) !== normalizeSkill(skill));
        setSkillEvidence((existing) => {
          const copy = { ...existing };
          delete copy[skill];
          return copy;
        });
        return next;
      }
      setSkillEvidence((existing) => ({ ...existing, [skill]: "" }));
      return [...current, skill];
    });
  }

  function addCustomSkill() {
    const normalized = customSkill.trim();
    if (!normalized) return;
    if (!selectedSkills.some((skill) => normalizeSkill(skill) === normalizeSkill(normalized))) {
      setSelectedSkills((current) => [...current, normalized]);
      setSkillEvidence((existing) => ({ ...existing, [normalized]: "" }));
    }
    setCustomSkill("");
  }

  function goNext() {
    if (!canContinue) return;
    setStep((current) => Math.min(steps.length - 1, current + 1));
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function goBack() {
    setStep((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!job || submitted || submittingRef.current) return;
    submittingRef.current = true;

    apply.mutate({
      slug: params.slug,
      portfolioUserId: skilioIdentity?.portfolioUserId,
      identityLinkId: skilioIdentity?.id,
      source: applyingWithSkilio ? "SKILIO" : "GUEST",
      name: name.trim(),
      email: email.trim(),
      phone: cleanOptionalText(
        [phoneCountryCode, phone.trim()].filter(Boolean).join(" "),
      ),
      location: cleanOptionalText(location),
      coverLetter: cleanOptionalText(coverLetter),
      skills: selectedSkills.map((skill) => skill.trim()).filter(Boolean),
      links: {
        portfolio: cleanOptionalUrl(portfolio),
        linkedin: cleanOptionalUrl(linkedin),
        github: cleanOptionalUrl(github),
        website: cleanOptionalUrl(website),
        resume: cleanOptionalUrl(resumeUrl),
      },
      screeningAnswers,
      drawingResponses: canReuseDrawingAssessment
        ? undefined
        : drawingResponses,
      profileSnapshot: {
        portfolioUserId: skilioIdentity?.portfolioUserId,
        identityLinkId: skilioIdentity?.id,
        portfolioUsername: skilioIdentity?.username,
        portfolioSnapshot: skilioProfileSnapshot,
        portfolioSkills: skilioSkills,
        profileId: profile?.id,
        organization: profile?.organization,
        authChoice: applyingWithSkilio ? "signed_in" : authChoice,
        skillEvidence,
        screeningAnswers,
        resumeFileName,
        resumeUrl,
      },
    });
  }

  const applyNextPath = `/apply/${params.slug}`;
  const signInHref = `/auth/skilio/start?next=${encodeURIComponent(applyNextPath)}`;

  return (
    <main className="skilio-interface min-h-screen overflow-x-hidden bg-[var(--skilio-canvas)] text-[var(--skilio-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--skilio-border)] bg-[rgba(244,249,242,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logos/skilio-leaf-square.png"
              alt="Skilio"
              width={40}
              height={40}
              className="h-10 w-10 rounded-[var(--skilio-radius-md)] shadow-[var(--skilio-shadow-1)]"
              priority
            />
            <div>
              <div className="text-sm font-semibold">Skilio</div>
              <div className="text-xs text-[var(--skilio-ink-muted)]">Candidate application</div>
            </div>
          </Link>
          {authLoading ? (
            <Badge variant="outline" className="rounded-[var(--skilio-radius-md)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink-soft)]">
              Checking Skilio session
            </Badge>
          ) : applyingWithSkilio ? (
            <Badge className="rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)] hover:bg-[var(--skilio-control-strong)]">
              Signed in with Skilio
            </Badge>
          ) : applyingManually ? (
            <Badge variant="outline" className="rounded-[var(--skilio-radius-md)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink-soft)]">
              Applying manually
            </Badge>
          ) : (
            <div className="hidden items-center sm:flex">
              <Button asChild variant="outline" className="gap-2 rounded-[var(--skilio-radius-md)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] hover:bg-[var(--skilio-control)]">
                <a href={signInHref}>
                  <LogIn className="h-4 w-4" />
                  Sign in
                </a>
              </Button>
            </div>
          )}
        </div>
      </header>

      <SkilioMotionRoot className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[390px_1fr]">
        <aside className="space-y-4">
          <JobSummaryCard job={job} loading={jobQuery.isLoading} unavailable={jobUnavailable} />
        </aside>

        <section className="min-w-0 space-y-4">
          {!submitted && !jobUnavailable && <StepRail current={currentStep} />}

          <SkilioPanel className="p-5 shadow-[0_28px_90px_rgba(14,33,72,0.09)] sm:p-6">
            {jobQuery.isLoading || authLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : jobUnavailable ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <BriefcaseBusiness className="h-14 w-14 text-[var(--skilio-ink-muted)]" />
                <h2 className="mt-5 text-2xl font-semibold">Application unavailable</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--skilio-ink-soft)]">
                  This job is not accepting applications right now. Ask the employer for a current Skilio application link.
                </p>
              </div>
            ) : submitted ? (
              <div className="mx-auto flex min-h-[560px] max-w-2xl flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--skilio-brand)] text-white shadow-[var(--skilio-shadow-2)]">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <h2 className="mt-6 text-3xl font-semibold">Application submitted</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-[var(--skilio-ink-soft)]">
                  Your profile, skill signal, and evidence were sent to the hiring team. You can keep improving your Skilio portfolio while they review your application.
                </p>
                <div className="mt-8 w-full rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-4 text-left">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--skilio-ink-muted)]">What happens next</div>
                  <div className="mt-4 space-y-3 text-sm text-[var(--skilio-ink-soft)]">
                    <div className="flex gap-3"><Check className="h-4 w-4 text-[var(--skilio-brand)]" />Application received</div>
                    <div className="flex gap-3"><FileCheck2 className="h-4 w-4 text-[var(--skilio-brand)]" />Employer reviews your skill evidence</div>
                    <div className="flex gap-3"><ShieldCheck className="h-4 w-4 text-[var(--skilio-brand)]" />You will be contacted if accepted to the next stage</div>
                  </div>
                </div>
                <Button asChild className="mt-6 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">
                  <a href={profileUrl}>Open Skilio portfolio</a>
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-6">
                {currentStep === 0 && (
                  <div className="space-y-5">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control-strong)] px-3 py-1 text-sm font-medium text-[var(--skilio-brand-strong)]">
                        <Sparkles className="h-4 w-4" />
                        Choose how to apply
                      </div>
                      <h2 className="mt-4 text-2xl font-semibold text-[var(--skilio-ink)]">Start with your Skilio profile or apply manually.</h2>
                      <p className="mt-2 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                        Sign in to reuse your verified profile, or continue
                        manually without leaving this application.
                      </p>
                    </div>

                    <div className="grid gap-3">
                      {applyingWithSkilio ? (
                        <button
                          type="button"
                          onClick={() => setAuthChoice("skilio")}
                          className="flex items-center justify-between rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)] p-4 text-left transition hover:bg-[var(--skilio-control-strong)]"
                        >
                          <span className="flex items-center gap-3">
                            <Check className="h-5 w-5 text-[var(--skilio-brand)]" />
                            <span>
                              <span className="block font-semibold">Already signed in with Skilio</span>
                              <span className="text-sm text-[var(--skilio-ink-soft)]">
                                We will reuse your verified profile, CV, skills, and evidence.
                              </span>
                            </span>
                          </span>
                          <Badge className="rounded-md bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand)]">
                            Active
                          </Badge>
                        </button>
                      ) : (
                        <a
                          href={signInHref}
                          className="flex items-center justify-between rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-panel)] p-4 text-left transition hover:bg-[var(--skilio-control)]"
                        >
                          <span className="flex items-center gap-3">
                            <LogIn className="h-5 w-5 text-[var(--skilio-brand)]" />
                            <span>
                              <span className="block font-semibold">Sign in with Skilio</span>
                              <span className="text-sm text-[var(--skilio-ink-soft)]">Reuse your verified profile and contact information.</span>
                            </span>
                          </span>
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setAuthChoice("guest")}
                        className={cn(
                          "flex items-center justify-between rounded-[var(--skilio-radius-lg)] border p-4 text-left transition",
                          authChoice === "guest"
                            ? "border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)]"
                            : "border-[var(--skilio-border)] bg-[var(--skilio-panel)] hover:bg-[var(--skilio-control)]",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <FileCheck2 className="h-5 w-5 text-[var(--skilio-brand)]" />
                          <span>
                            <span className="block font-semibold">Continue manually</span>
                            <span className="text-sm text-[var(--skilio-ink-soft)]">
                              Fill the application now. Your details can be
                              linked to Skilio later.
                            </span>
                          </span>
                        </span>
                        {authChoice === "guest" && <Check className="h-5 w-5 text-[var(--skilio-brand)]" />}
                      </button>
                    </div>
                  </div>
                )}

                {currentStep === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-semibold text-[var(--skilio-ink)]">Your profile</h2>
                      <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">Tell the hiring team who you are and how to reach you.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="name">Full name</Label>
                        <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required className="mt-2" />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-2" />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <div className="mt-2 grid grid-cols-[150px_1fr] gap-2">
                          <Select
                            value={phoneCountryCode}
                            onValueChange={setPhoneCountryCode}
                          >
                            <SelectTrigger aria-label="Phone country code">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {phoneCountryCodes.map(([code, country]) => (
                                <SelectItem key={`${code}-${country}`} value={code}>
                                  {code} {country}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            placeholder="12 345 6789"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Country</Label>
                        <Select value={location} onValueChange={setLocation}>
                          <SelectTrigger className="mt-2" aria-label="Country">
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            {countries.map((country) => (
                              <SelectItem key={country} value={country}>
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-semibold text-[var(--skilio-ink)]">
                        Drawmetrics
                      </h2>
                      <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">
                        Complete ten drawings by continuing each fixed mark and
                        naming the picture you create.
                      </p>
                    </div>
                    {drawingStatusQuery.isLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-12 w-64" />
                        <Skeleton className="h-[430px] w-full" />
                      </div>
                    ) : reusableDrawingStatus ? (
                      <div
                        data-testid="drawmetrics-reused"
                        className="rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-6"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--skilio-ink)]">
                              Your Drawmetrics set is current
                            </div>
                            <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--skilio-ink-soft)]">
                              You completed all ten drawings on{" "}
                              {new Date(
                                reusableDrawingStatus.completedAt,
                              ).toLocaleDateString()}
                              . It can be reused until{" "}
                              {new Date(
                                reusableDrawingStatus.expiresAt,
                              ).toLocaleDateString()}
                              , so you do not need to repeat it for this
                              application.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <ApplicationDrawingAssessment
                        onChange={setDrawingResponses}
                      />
                    )}
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-semibold text-[var(--skilio-ink)]">
                        Submit skills information
                      </h2>
                      <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">
                        Select the role skills you have and add any other skills
                        that strengthen your application.
                      </p>
                    </div>

                    <div className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-4">
                      <div className="text-sm font-semibold text-[var(--skilio-ink)]">
                        Skills required for this role
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[var(--skilio-ink-soft)]">
                        Only select skills you can discuss with the hiring team.
                        Nothing is selected automatically.
                      </p>
                      <div className="mt-3 grid gap-2">
                        {(job?.job_skills ?? []).map((jobSkill) => {
                          const skill = jobSkill.name;
                          const active = selectedSkills.some((item) => normalizeSkill(item) === normalizeSkill(skill));
                          return (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => toggleSkill(skill)}
                              className={cn(
                                "flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--skilio-radius-md)] border px-3 py-2 text-left text-sm font-medium transition",
                                active
                                  ? "border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]"
                                  : "border-[var(--skilio-border)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink-soft)] hover:border-[var(--skilio-border-strong)]",
                              )}
                            >
                              <span className="flex items-center gap-2">
                                {active ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {skill}
                              </span>
                              <Badge
                                variant="outline"
                                className="rounded-md bg-[var(--skilio-elevated)] text-[var(--skilio-ink-muted)]"
                              >
                                {jobSkill.priority === "MUST"
                                  ? "Must-have"
                                  : "Nice-to-have"}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-semibold text-[var(--skilio-ink)]">
                        Your other skills
                      </div>
                      <div className="flex gap-2">
                      <Input
                        value={customSkill}
                        onChange={(event) => setCustomSkill(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addCustomSkill();
                          }
                        }}
                        placeholder="Add another skill"
                      />
                      <Button type="button" variant="outline" onClick={addCustomSkill} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add
                      </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {selectedSkills.map((skill) => (
                        <div key={skill} className="rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-panel)] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold">{skill}</div>
                            <button
                              type="button"
                              aria-label={`Remove ${skill}`}
                              onClick={() => toggleSkill(skill)}
                              className="flex h-10 w-10 items-center justify-center rounded-[var(--skilio-radius-sm)] text-[var(--skilio-ink-muted)] hover:bg-[var(--skilio-control)]"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <Textarea
                            value={skillEvidence[skill] ?? ""}
                            onChange={(event) => setSkillEvidence((current) => ({ ...current, [skill]: event.target.value }))}
                            className="mt-3 min-h-20"
                            placeholder={`Optional: share where you used ${skill} or link it to a portfolio example.`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-semibold text-[var(--skilio-ink)]">
                        Additional portfolio information
                      </h2>
                      <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">
                        Add optional links or a CV that help the employer review
                        your work.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="portfolio">Skilio or portfolio URL</Label>
                        <div className="relative mt-2">
                          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--skilio-ink-muted)]" />
                          <Input id="portfolio" value={portfolio} onChange={(event) => setPortfolio(event.target.value)} placeholder="https://portfolio.skilio.co/username" className="pl-9" />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="linkedin">LinkedIn URL</Label>
                        <div className="relative mt-2">
                          <Linkedin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--skilio-ink-muted)]" />
                          <Input id="linkedin" value={linkedin} onChange={(event) => setLinkedin(event.target.value)} placeholder="https://linkedin.com/in/yourname" className="pl-9" />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="github">GitHub URL</Label>
                        <div className="relative mt-2">
                          <Github className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--skilio-ink-muted)]" />
                          <Input id="github" value={github} onChange={(event) => setGithub(event.target.value)} placeholder="https://github.com/yourname" className="pl-9" />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="website">Website or case study</Label>
                        <Input id="website" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://your-site.com" className="mt-2" />
                      </div>
                    </div>

                    <div>
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-[var(--skilio-radius-lg)] border border-dashed border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] p-5 text-center hover:bg-[var(--skilio-control-strong)]">
                        <UploadCloud className="h-7 w-7 text-[var(--skilio-brand)]" />
                        <span className="mt-2 text-sm font-semibold">Resume file</span>
                        <span className="mt-1 text-xs text-[var(--skilio-ink-muted)]">
                          {resumeFileName
                            ? resumeUrl
                              ? `${resumeFileName} attached from Skilio profile`
                              : resumeFileName
                            : "Select a PDF or DOC file"}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="sr-only"
                          onChange={(event) => {
                            setResumeFileName(event.target.files?.[0]?.name ?? "");
                            setResumeUrl("");
                          }}
                        />
                      </label>
                    </div>

                    <div>
                      <Label htmlFor="cover">
                        Tell us why you are applying for this role (optional)
                      </Label>
                      <Textarea
                        id="cover"
                        value={coverLetter}
                        onChange={(event) => setCoverLetter(event.target.value)}
                        className="mt-2 min-h-36"
                        placeholder="Share what interests you about the role and what you hope to contribute."
                      />
                    </div>
                  </div>
                )}

                {currentStep === 5 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-semibold text-[var(--skilio-ink)]">
                        Pre-screening questions
                      </h2>
                      <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">
                        Answer the role-specific questions from the hiring team.
                      </p>
                    </div>
                    {(job?.screeningQuestions ?? []).length === 0 ? (
                      <div className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-5 text-sm text-[var(--skilio-ink-soft)]">
                        This role has no pre-screening questions.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(job?.screeningQuestions ?? []).map(
                          (question, index) => (
                            <div
                              key={question.id}
                              className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-4"
                            >
                              <Label htmlFor={`screening-${question.id}`}>
                                {index + 1}. {question.prompt}
                                {question.required ? " *" : ""}
                              </Label>
                              {question.type === "TEXT" ? (
                                <Textarea
                                  id={`screening-${question.id}`}
                                  value={screeningAnswers[question.id] ?? ""}
                                  onChange={(event) =>
                                    setScreeningAnswers((current) => ({
                                      ...current,
                                      [question.id]: event.target.value,
                                    }))
                                  }
                                  className="mt-2 min-h-24"
                                />
                              ) : (
                                <Select
                                  value={screeningAnswers[question.id] ?? ""}
                                  onValueChange={(value) =>
                                    setScreeningAnswers((current) => ({
                                      ...current,
                                      [question.id]: value,
                                    }))
                                  }
                                >
                                  <SelectTrigger
                                    id={`screening-${question.id}`}
                                    className="mt-2"
                                  >
                                    <SelectValue placeholder="Select an answer" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(question.type === "YES_NO"
                                      ? ["Yes", "No"]
                                      : question.options
                                    ).map((option) => (
                                      <SelectItem key={option} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                )}

                {currentStep === 6 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-semibold text-[var(--skilio-ink)]">Review application</h2>
                      <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">Check the details before sending them to the employer.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--skilio-ink-muted)]">Candidate</div>
                        <div className="mt-2 font-semibold">{name}</div>
                        <div className="text-sm text-[var(--skilio-ink-soft)]">{email}</div>
                      </div>
                      <div className="rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--skilio-ink-muted)]">Skills selected</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedSkills.map((skill) => (
                            <Badge key={skill} className="rounded-md bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)] hover:bg-[var(--skilio-control-strong)]">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-4 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--skilio-ink-muted)]">
                          Drawmetrics
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[var(--skilio-ink)]">
                          <CheckCircle2 className="h-4 w-4 text-[var(--skilio-brand)]" />
                          {canReuseDrawingAssessment
                            ? "Previous ten-drawing set will be reused"
                            : `${drawingResponses.length} drawings and ${drawingResponses.length} phrases attached`}
                        </div>
                      </div>
                      <div className="rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-4 md:col-span-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--skilio-ink-muted)]">
                          Portfolio
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                          {[portfolio, linkedin, github, website, resumeFileName]
                            .filter(Boolean)
                            .join(" / ") || "No additional portfolio information"}
                        </div>
                      </div>
                      {(job?.screeningQuestions ?? []).length > 0 && (
                        <div className="rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-4 md:col-span-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--skilio-ink-muted)]">
                            Pre-screening answers
                          </div>
                          <div className="mt-3 space-y-2 text-sm text-[var(--skilio-ink-soft)]">
                            {(job?.screeningQuestions ?? []).map((question) => (
                              <div key={question.id}>
                                <span className="font-medium text-[var(--skilio-ink)]">
                                  {question.prompt}
                                </span>
                                <span>
                                  {" "}
                                  {screeningAnswers[question.id] || "No answer"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {apply.isError && (
                  <div className="rounded-[var(--skilio-radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {apply.error?.message || "We could not submit this application. Check your details and try again."}
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-[var(--skilio-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    disabled={currentStep === 0 || apply.isLoading}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  {currentStep < steps.length - 1 ? (
                    <Button type="button" onClick={goNext} disabled={!canContinue} className="gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">
                      {
                        [
                          "Continue to profile",
                          "Continue to Drawmetrics",
                          "Continue to skills",
                          "Continue to portfolio",
                          "Continue to pre-screening",
                          "Review application",
                        ][currentStep]
                      }
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" className="gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">
                      Submit application
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </form>
            )}
          </SkilioPanel>
        </section>
      </SkilioMotionRoot>
    </main>
  );
}
