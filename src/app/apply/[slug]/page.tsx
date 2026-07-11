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
  UserPlus,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
};

type AuthChoice = "skilio" | "new" | "guest";

const steps = ["Access", "Profile", "Skill signal", "Evidence", "Review"] as const;

const profileUrl = "https://portfolio.skilio.co/";

function normalizeSkill(skill: string) {
  return skill.trim().toLowerCase();
}

function makeEvidenceDefaults(skills: string[]) {
  return Object.fromEntries(skills.map((skill) => [skill, ""]));
}

function makeConfidenceDefaults(skills: string[]) {
  return Object.fromEntries(skills.map((skill) => [skill, 3]));
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

function buildPhone(profile: Record<string, unknown>) {
  const phoneNumber = asString(profile.phoneNumber);
  if (!phoneNumber) return "";
  const countryCode = asString(profile.phoneCountryCode);
  return [countryCode, phoneNumber].filter(Boolean).join(" ");
}

function buildProfileSummary(profile: Record<string, unknown>) {
  const role = asString(profile.role);
  const experiences = Array.isArray(profile.experiences)
    ? (profile.experiences as Record<string, unknown>[])
    : [];
  const current = experiences.find((experience) => experience?.isCurrent) ?? experiences[0];
  const company = asString(current?.company);
  const title = firstNonEmpty(current?.jobTitle, role);
  const description = asString(current?.description);
  const summary = [
    title && company ? `${title} at ${company}.` : title ? `${title}.` : "",
    description,
  ]
    .filter(Boolean)
    .join(" ");
  return summary.slice(0, 600);
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
    <div className="rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-panel)] p-3 shadow-[var(--skilio-shadow-1)]">
      <div className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const state = index < current ? "done" : index === current ? "active" : "idle";
          return (
            <div
              key={step}
              className={cn(
                "flex min-w-[128px] flex-1 items-center gap-2 rounded-[var(--skilio-radius-md)] px-3 py-2 text-sm",
                state === "active" && "bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]",
                state === "done" && "bg-[var(--skilio-control)] text-[var(--skilio-ink)]",
                state === "idle" && "text-[var(--skilio-ink-muted)]",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--skilio-radius-sm)] text-xs font-semibold",
                  state === "active" && "bg-[var(--skilio-brand)] text-white",
                  state === "done" && "bg-[var(--skilio-signal)] text-[var(--skilio-ink)]",
                  state === "idle" && "bg-[var(--skilio-control)]",
                )}
              >
                {state === "done" ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              {step}
            </div>
          );
        })}
      </div>
    </div>
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
        <p className="mt-5 max-h-60 overflow-y-auto whitespace-pre-line pr-1 text-sm leading-6 text-white/76">
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
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [website, setWebsite] = useState("");
  const [customSkill, setCustomSkill] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillEvidence, setSkillEvidence] = useState<Record<string, string>>({});
  const [skillConfidence, setSkillConfidence] = useState<Record<string, number>>({});
  const [workSamplePrompt, setWorkSamplePrompt] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [certificateFileNames, setCertificateFileNames] = useState<string[]>([]);

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

    const nextPhone = buildPhone(skilioProfileSnapshot);
    if (nextPhone && !phone) setPhone(nextPhone);

    const nextLocation = firstNonEmpty(skilioProfileSnapshot.country);
    if (nextLocation && !location) setLocation(nextLocation);

    const nextBio = buildProfileSummary(skilioProfileSnapshot);
    if (nextBio && !bio) setBio(nextBio);

    const nextPortfolio = firstNonEmpty(skilioProfileSnapshot.publicUrl);
    if (nextPortfolio && !portfolio) setPortfolio(nextPortfolio);

    if (skilioCv?.filename && !resumeFileName) setResumeFileName(skilioCv.filename);
    if (skilioCv?.url && !resumeUrl) setResumeUrl(skilioCv.url);
  }, [
    authChoice,
    bio,
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
      setSkillConfidence((current) => ({
        ...makeConfidenceDefaults(seeded),
        ...current,
      }));
    }
  }, [expectedSkills, selectedSkills, skilioSkillEvidence, skilioSkills]);

  useEffect(() => {
    if (authLoading || selectedSkills.length > 0 || expectedSkills.length === 0 || skilioSkills.length > 0) return;
    const seeded = expectedSkills.slice(0, 5);
    setSelectedSkills(seeded);
    setSkillEvidence(makeEvidenceDefaults(seeded));
    setSkillConfidence(makeConfidenceDefaults(seeded));
  }, [authLoading, expectedSkills, selectedSkills.length, skilioSkills.length]);

  const applyingWithSkilio = Boolean(user && (authChoice === "skilio" || authChoice === null));
  const applyingManually = authChoice === "guest";
  const currentStep = step;

  const canContinue = useMemo(() => {
    if (submitted) return false;
    if (currentStep === 0) return !authLoading && (applyingWithSkilio || applyingManually);
    if (currentStep === 1) return name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email);
    if (currentStep === 2) return selectedSkills.length > 0 && workSamplePrompt.trim().length >= 20;
    if (currentStep === 3) return Boolean(portfolio || linkedin || github || website || resumeFileName || resumeUrl || certificateFileNames.length);
    return true;
  }, [
    applyingManually,
    applyingWithSkilio,
    authLoading,
    certificateFileNames.length,
    email,
    github,
    linkedin,
    name,
    portfolio,
    resumeFileName,
    resumeUrl,
    selectedSkills.length,
    currentStep,
    submitted,
    website,
    workSamplePrompt,
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
        setSkillConfidence((existing) => {
          const copy = { ...existing };
          delete copy[skill];
          return copy;
        });
        return next;
      }
      setSkillEvidence((existing) => ({ ...existing, [skill]: "" }));
      setSkillConfidence((existing) => ({ ...existing, [skill]: 3 }));
      return [...current, skill];
    });
  }

  function addCustomSkill() {
    const normalized = customSkill.trim();
    if (!normalized) return;
    if (!selectedSkills.some((skill) => normalizeSkill(skill) === normalizeSkill(normalized))) {
      setSelectedSkills((current) => [...current, normalized]);
      setSkillEvidence((existing) => ({ ...existing, [normalized]: "" }));
      setSkillConfidence((existing) => ({ ...existing, [normalized]: 3 }));
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
      phone: cleanOptionalText(phone),
      location: cleanOptionalText(location),
      bio: cleanOptionalText(bio),
      coverLetter: cleanOptionalText(coverLetter),
      skills: selectedSkills.map((skill) => skill.trim()).filter(Boolean),
      links: {
        portfolio: cleanOptionalUrl(portfolio),
        linkedin: cleanOptionalUrl(linkedin),
        github: cleanOptionalUrl(github),
        website: cleanOptionalUrl(website),
        resume: cleanOptionalUrl(resumeUrl),
      },
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
        skillConfidence,
        workSamplePrompt,
        resumeFileName,
        resumeUrl,
        certificateFileNames,
      },
    });
  }

  const applyNextPath = `/apply/${params.slug}`;
  const signInHref = `/auth/skilio/start?next=${encodeURIComponent(applyNextPath)}`;
  const assessmentBaseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const signupRedirect = `${assessmentBaseUrl}${signInHref}`;
  const signupHref = `${profileUrl}signup?redirect=${encodeURIComponent(signupRedirect)}`;

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
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="outline" className="gap-2 rounded-[var(--skilio-radius-md)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] hover:bg-[var(--skilio-control)]">
                <a href={signInHref}>
                  <LogIn className="h-4 w-4" />
                  Sign in
                </a>
              </Button>
              <Button asChild className="gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">
                <a href={signupHref}>
                  <UserPlus className="h-4 w-4" />
                  Sign up
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

        <section className="space-y-4">
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
                        Candidates can sign in, create a Skilio account, or continue manually without an account.
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

                      <a
                        href={signupHref}
                        className="flex items-center justify-between rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-panel)] p-4 text-left transition hover:bg-[var(--skilio-control)]"
                      >
                        <span className="flex items-center gap-3">
                          <UserPlus className="h-5 w-5 text-[var(--skilio-brand)]" />
                          <span>
                            <span className="block font-semibold">Create a Skilio account</span>
                            <span className="text-sm text-[var(--skilio-ink-soft)]">Build a reusable candidate profile for this and future roles.</span>
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </a>

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
                            <span className="text-sm text-[var(--skilio-ink-soft)]">Fill the application now without signing in.</span>
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
                        <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2" />
                      </div>
                      <div>
                        <Label htmlFor="candidate-location">Location</Label>
                        <Input id="candidate-location" value={location} onChange={(event) => setLocation(event.target.value)} className="mt-2" />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="bio">Profile summary</Label>
                        <Textarea
                          id="bio"
                          value={bio}
                          onChange={(event) => setBio(event.target.value.slice(0, 600))}
                          className="mt-2 min-h-28"
                          placeholder="Summarize your current role, strengths, and the kind of work you do best."
                        />
                        <div className="mt-1 text-right text-xs text-[var(--skilio-ink-muted)]">{bio.length} / 600</div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-semibold text-[var(--skilio-ink)]">Interactive skill signal</h2>
                      <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">
                        Select the skills you want reviewed, rate your confidence, and add short evidence.
                      </p>
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-semibold text-[var(--skilio-ink)]">Role skills</div>
                      <div className="flex flex-wrap gap-2">
                        {(expectedSkills.length ? expectedSkills : ["Communication", "Problem solving", "Project ownership"]).map((skill) => {
                          const active = selectedSkills.some((item) => normalizeSkill(item) === normalizeSkill(skill));
                          return (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => toggleSkill(skill)}
                              className={cn(
                                "inline-flex h-9 items-center gap-2 rounded-[var(--skilio-radius-md)] border px-3 text-sm font-medium transition",
                                active
                                  ? "border-[var(--skilio-brand)] bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]"
                                  : "border-[var(--skilio-border)] bg-[var(--skilio-panel)] text-[var(--skilio-ink-soft)] hover:bg-[var(--skilio-control)]",
                              )}
                            >
                              {active ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                              {skill}
                            </button>
                          );
                        })}
                      </div>
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

                    <div className="space-y-3">
                      {selectedSkills.map((skill) => (
                        <div key={skill} className="rounded-[var(--skilio-radius-lg)] border border-[var(--skilio-border)] bg-[var(--skilio-panel)] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="font-semibold">{skill}</div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((level) => (
                                <button
                                  key={level}
                                  type="button"
                                  aria-label={`${skill} confidence ${level}`}
                                  onClick={() => setSkillConfidence((current) => ({ ...current, [skill]: level }))}
                                  className={cn(
                                    "h-7 w-7 rounded-[var(--skilio-radius-sm)] text-xs font-semibold",
                                    (skillConfidence[skill] ?? 3) >= level
                                      ? "bg-[var(--skilio-brand)] text-white"
                                      : "bg-[var(--skilio-control)] text-[var(--skilio-ink-muted)]",
                                  )}
                                >
                                  {level}
                                </button>
                              ))}
                              <button type="button" onClick={() => toggleSkill(skill)} className="ml-2 rounded-[var(--skilio-radius-sm)] p-1 text-[var(--skilio-ink-muted)] hover:bg-[var(--skilio-control)]">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <Textarea
                            value={skillEvidence[skill] ?? ""}
                            onChange={(event) => setSkillEvidence((current) => ({ ...current, [skill]: event.target.value }))}
                            className="mt-3 min-h-20"
                            placeholder={`Briefly show where you used ${skill}.`}
                          />
                        </div>
                      ))}
                    </div>

                    <div>
                      <Label htmlFor="work-sample">Mini work sample</Label>
                      <Textarea
                        id="work-sample"
                        value={workSamplePrompt}
                        onChange={(event) => setWorkSamplePrompt(event.target.value)}
                        className="mt-2 min-h-32"
                        placeholder="Describe a recent project, what you owned, and how you measured the result."
                      />
                      <p className="mt-2 text-xs text-[var(--skilio-ink-muted)]">Minimum 20 characters. This replaces an interview requirement for the initial application.</p>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-semibold text-[var(--skilio-ink)]">Evidence and profiles</h2>
                      <p className="mt-1 text-sm text-[var(--skilio-ink-soft)]">Attach profile links or file names the employer can use during review.</p>
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

                    <div className="grid gap-4 md:grid-cols-2">
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
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-[var(--skilio-radius-lg)] border border-dashed border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] p-5 text-center hover:bg-[var(--skilio-control-strong)]">
                        <FileCheck2 className="h-7 w-7 text-[var(--skilio-brand)]" />
                        <span className="mt-2 text-sm font-semibold">Certificates or proof</span>
                        <span className="mt-1 text-xs text-[var(--skilio-ink-muted)]">
                          {certificateFileNames.length ? certificateFileNames.join(", ") : "Select supporting files"}
                        </span>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="sr-only"
                          onChange={(event) => setCertificateFileNames(Array.from(event.target.files ?? []).map((file) => file.name))}
                        />
                      </label>
                    </div>

                    <div>
                      <Label htmlFor="cover">Cover note</Label>
                      <Textarea
                        id="cover"
                        value={coverLetter}
                        onChange={(event) => setCoverLetter(event.target.value)}
                        className="mt-2 min-h-36"
                        placeholder="Tell the team why this role fits your next step."
                      />
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
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
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--skilio-ink-muted)]">Evidence</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                          {[portfolio, linkedin, github, website, resumeFileName, ...certificateFileNames].filter(Boolean).join(" / ") || "No evidence added"}
                        </div>
                      </div>
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
                      {currentStep === 0 ? "Continue to profile" : currentStep === 1 ? "Continue to skills" : currentStep === 2 ? "Continue to evidence" : "Review application"}
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
