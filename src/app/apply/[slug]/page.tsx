"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  FileCheck2,
  Github,
  Link2,
  Linkedin,
  Loader2,
  LogIn,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApplicationDrawingAssessment } from "@/components/drawing/application-drawing-assessment";
import {
  ApplicationSkillsSignal,
} from "@/components/jobs/application-skills-signal";
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
  isCompleteDrawingResponses,
  type ApplicationDrawingResponse,
} from "@/lib/drawing-assessment";
import {
  MAX_APPLICATION_FILES,
  type ApplicationFileKind,
  validateApplicationFile,
} from "@/lib/jobs/application-files";
import {
  EMPTY_APPLICATION_EVIDENCE,
  confirmedArtifactSkills,
  serializeApplicationEvidence,
  type ApplicationEvidenceState,
  type PortfolioEvidenceItem,
  type PortfolioEvidenceSkill,
} from "@/lib/jobs/application-evidence-state";
import type { Json } from "@/lib/supabase/types";

type PublicJob = {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employmentType?: string | null;
  seniority?: string | null;
  description?: string | null;
  job_skills: {
    id: string;
    name: string;
    kind: string;
    priority: string;
    lightcastCategoryId?: string | null;
    lightcastCategoryName?: string | null;
    lightcastSubcategoryId?: string | null;
    lightcastSubcategoryName?: string | null;
  }[];
  screeningQuestions?: {
    id: string;
    prompt: string;
    type: "TEXT" | "YES_NO" | "SELECT";
    required: boolean;
    options: string[];
  }[];
};

type AuthChoice = "skilio" | "guest";

type PortfolioProvisioningView = {
  status: "CREATED" | "EXISTING_ACCOUNT" | "FAILED";
  nextUrl?: string | null;
  activationEmailSent?: boolean | null;
  skillsAdded?: number;
  skillsAlreadyPresent?: number;
  message?: string;
};

type LocalApplicationFile = {
  id: string;
  file: File;
  skillNames: string[];
};

type ApplicationUploadSession = {
  applicationId: string;
  fileUploadToken: string;
  portfolioProvisioning: PortfolioProvisioningView | null;
};

const steps = [
  "Access",
  "Profile",
  "Drawmetrics",
  "Skills signal",
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

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return "";
}

function getApplicationErrorMessage(message?: string) {
  if (
    message?.includes("drawingResponses") ||
    message?.includes("must use the") ||
    message?.includes("Drawmetrics")
  ) {
    return "Your Drawmetrics set is incomplete. Return to Drawmetrics and complete all ten drawings before submitting.";
  }
  return (
    message ||
    "We could not submit this application. Check your details and try again."
  );
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

function parsePortfolioEvidence(profile: Record<string, unknown>): PortfolioEvidenceSkill[] {
  return getSkillEvidence(profile).flatMap((item, skillIndex) => {
    const name = asString(item.name);
    if (!name) return [];
    const mapItems = (
      value: unknown,
      kind: PortfolioEvidenceItem["kind"],
    ): PortfolioEvidenceItem[] =>
      (Array.isArray(value) ? value : []).flatMap((raw, itemIndex) => {
        const entry = asRecord(raw as Json);
        const id = firstNonEmpty(entry.id, `${kind}-${skillIndex}-${itemIndex}`);
        const createdAt = firstNonEmpty(entry.addedAt, entry.createdAt, entry.updatedAt);
        if (!createdAt) return [];
        return [{
          id,
          kind,
          name: firstNonEmpty(entry.title, entry.fileName, entry.url, entry.fileUrl, kind === "proof" ? "Portfolio proof" : "Portfolio video"),
          description: firstNonEmpty(entry.description, entry.title),
          url: firstNonEmpty(entry.url, entry.fileUrl) || null,
          fileName: firstNonEmpty(entry.fileName) || null,
          fileType: firstNonEmpty(entry.fileType) || null,
          fileSize: typeof entry.fileSize === "number" ? entry.fileSize : null,
          createdAt,
          validationStatus: kind === "proof" ? firstNonEmpty(entry.validationStatus) || null : null,
        }];
      });
    return [{
      id: firstNonEmpty(item.id, `portfolio-skill-${skillIndex}`),
      name,
      lightcastId: firstNonEmpty(item.lightcastId) || null,
      lightcastType: firstNonEmpty(item.lightcastType) || null,
      lightcastDescription: firstNonEmpty(item.lightcastDescription) || null,
      lightcastApiVersion: firstNonEmpty(item.lightcastApiVersion) || null,
      categoryId: firstNonEmpty(item.categoryId) || null,
      categoryName: firstNonEmpty(item.categoryName, item.category) || null,
      subcategoryId: firstNonEmpty(item.subcategoryId) || null,
      subcategoryName: firstNonEmpty(item.subcategoryName) || null,
      proofs: mapItems(item.proofs, "proof"),
      videos: mapItems(item.videos, "video"),
    }];
  });
}

function StepRail({ current }: { current: number }) {
  const nextStep = steps[current + 1];

  return (
    <nav
      aria-label="Application progress"
      className="border-y border-[var(--skilio-border)] py-5"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-[var(--skilio-ink-muted)]">
            Application progress
          </div>
          <div className="mt-1 text-lg font-semibold text-[var(--skilio-ink)]">
            {steps[current]}
          </div>
        </div>
        <div className="shrink-0 text-sm font-medium tabular-nums text-[var(--skilio-ink-soft)]">
          Step {current + 1} of {steps.length}
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={current + 1}
        className="mt-4 grid grid-cols-7 gap-1.5"
      >
        {steps.map((step, index) => {
          const state = index < current ? "done" : index === current ? "active" : "idle";
          return (
            <span
              key={step}
              aria-hidden="true"
              className={cn(
                "h-1 rounded-full",
                state === "idle"
                  ? "bg-[var(--skilio-border-strong)]"
                  : "bg-[var(--skilio-brand)]",
              )}
            />
          );
        })}
      </div>

      <ol className="mt-3 hidden grid-cols-7 gap-2 sm:grid">
        {steps.map((step, index) => {
          const state = index < current ? "done" : index === current ? "active" : "idle";
          return (
            <li
              key={step}
              aria-current={state === "active" ? "step" : undefined}
              className="flex min-w-0 items-center gap-1.5"
            >
              <span
                data-testid="application-step-marker"
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center text-xs font-semibold tabular-nums",
                  state === "active"
                    ? "text-[var(--skilio-brand-strong)]"
                    : state === "done"
                      ? "text-[var(--skilio-brand)]"
                      : "text-[var(--skilio-ink-muted)]",
                )}
              >
                {state === "done" ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "truncate text-[11px] font-medium",
                  state === "active"
                    ? "text-[var(--skilio-ink)]"
                    : "text-[var(--skilio-ink-muted)]",
                )}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>

      {nextStep && (
        <div className="mt-3 text-xs text-[var(--skilio-ink-muted)] sm:hidden">
          Next: {nextStep}
        </div>
      )}
    </nav>
  );
}

function JobSummaryCard({
  job,
  loading,
  unavailable,
  compact,
}: {
  job?: PublicJob;
  loading: boolean;
  unavailable: boolean;
  compact: boolean;
}) {
  if (loading) {
    return (
      <div className="pb-7">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-10 w-3/4" />
        <Skeleton className="mt-3 h-5 w-1/2" />
      </div>
    );
  }
  if (unavailable || !job) {
    return (
      <section className="pb-7">
        <h1 className="text-2xl font-semibold">Job not available</h1>
        <p className="mt-2 text-sm text-[var(--skilio-ink-soft)]">
          This application link may be closed or unpublished.
        </p>
      </section>
    );
  }

  if (compact) {
    return (
      <section className="border-b border-[var(--skilio-border)] pb-5">
        <div className="text-xs font-medium text-[var(--skilio-ink-muted)]">
          Applying for
        </div>
        <h1 className="mt-1 max-w-3xl text-xl font-semibold leading-tight text-[var(--skilio-ink)] sm:text-2xl">
          {job.title}
        </h1>
      </section>
    );
  }

  return (
    <section className="pb-7">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--skilio-brand-strong)]">
        <BriefcaseBusiness className="h-4 w-4" />
        <span>{job.department || "Open role"}</span>
      </div>
      <h1 className="mt-3 max-w-3xl text-[clamp(1.9rem,5vw,2.8rem)] font-semibold leading-[1.08] text-[var(--skilio-ink)]">
        {job.title}
      </h1>
      <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-sm text-[var(--skilio-ink-soft)]">
        {[job.location, job.employmentType, job.seniority]
          .filter(Boolean)
          .map((item, index) => (
            <span key={item}>
              {index > 0 && (
                <span aria-hidden="true" className="mr-2 text-[var(--skilio-ink-muted)]">
                  /
                </span>
              )}
              {item}
            </span>
          ))}
      </div>

      <div className="mt-8 border-t border-[var(--skilio-border)] pt-6">
        <h2 className="text-lg font-semibold text-[var(--skilio-ink)]">
          About the role
        </h2>
        <p className="mt-3 max-w-3xl whitespace-pre-wrap break-words text-sm leading-7 text-[var(--skilio-ink-soft)]">
          {job.description || "Share your Skilio profile and tell us why this role fits you."}
        </p>
      </div>

      {job.job_skills.length > 0 && (
        <div className="mt-7 border-t border-[var(--skilio-border)] pt-6">
          <h2 className="text-lg font-semibold text-[var(--skilio-ink)]">
            Skills for this role
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {job.job_skills.map((skill) => (
              <Badge
                key={skill.id}
                variant="outline"
                className={cn(
                  "rounded-md border-[var(--skilio-border)] px-2.5 py-1 text-xs font-medium",
                  skill.priority === "MUST"
                    ? "bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)]"
                    : "bg-[var(--skilio-elevated)] text-[var(--skilio-ink-soft)]",
                )}
              >
                {skill.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function CandidateApplicationPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const { user, profile, skilioIdentity, loading: authLoading } = useAuth();
  const submittingRef = useRef(false);
  const attributionEventsRef = useRef(new Set<string>());
  const sourceTrackingCode = searchParams.get("src")?.trim() || null;
  const [submitted, setSubmitted] = useState(false);
  const [submittedApplicationId, setSubmittedApplicationId] = useState("");
  const [portfolioProvisioning, setPortfolioProvisioning] =
    useState<PortfolioProvisioningView | null>(null);
  const [hasStarted, setHasStarted] = useState(
    searchParams.get("stage") === "access",
  );
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
  const [applicationEvidence, setApplicationEvidence] =
    useState<ApplicationEvidenceState>(EMPTY_APPLICATION_EVIDENCE);
  const [screeningAnswers, setScreeningAnswers] = useState<
    Record<string, string>
  >({});
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeFile, setResumeFile] = useState<LocalApplicationFile | null>(
    null,
  );
  const [fileError, setFileError] = useState("");
  const [applicationError, setApplicationError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadSession, setUploadSession] =
    useState<ApplicationUploadSession | null>(null);
  const [drawingResponses, setDrawingResponses] = useState<
    ApplicationDrawingResponse[]
  >([]);
  const [sourceVisitorId, setSourceVisitorId] = useState<string | null>(null);

  const jobQuery = trpc.job.getPublicBySlug.useQuery(
    { slug: params.slug },
    { retry: false },
  );
  const apply = trpc.job.apply.useMutation();
  const finalizeEvidence = trpc.job.finalizeApplicationEvidence.useMutation();
  const retryProvisioning = trpc.job.retryPortfolioProvisioning.useMutation({
    onSuccess: (data) => {
      setPortfolioProvisioning(data as PortfolioProvisioningView);
    },
  });
  const trackSourceVisit = trpc.job.trackSourceVisit.useMutation();

  const job = jobQuery.data as PublicJob | undefined;
  const jobUnavailable = jobQuery.isError || (!job && !jobQuery.isLoading);
  const skilioProfileSnapshot = useMemo(
    () => asRecord(skilioIdentity?.profileSnapshot),
    [skilioIdentity?.profileSnapshot],
  );
  const skilioCv = useMemo(
    () => getCvAttachment(skilioProfileSnapshot),
    [skilioProfileSnapshot],
  );
  const skilioPortfolioSkills = useMemo(
    () => parsePortfolioEvidence(skilioProfileSnapshot),
    [skilioProfileSnapshot],
  );
  const serializedEvidence = useMemo(
    () => serializeApplicationEvidence(applicationEvidence),
    [applicationEvidence],
  );

  useEffect(() => {
    const storageKey = `skilio-job-attribution:${params.slug}`;
    let visitorId = window.localStorage.getItem(storageKey);

    if (!visitorId && sourceTrackingCode) {
      visitorId = window.crypto.randomUUID();
      window.localStorage.setItem(storageKey, visitorId);
    }
    if (visitorId) setSourceVisitorId(visitorId);
    if (!visitorId || !sourceTrackingCode) return;

    const eventKey = `VISIT:${visitorId}:${sourceTrackingCode}`;
    if (attributionEventsRef.current.has(eventKey)) return;
    attributionEventsRef.current.add(eventKey);
    trackSourceVisit.mutate({
      slug: params.slug,
      trackingCode: sourceTrackingCode,
      visitorId,
      event: "VISIT",
      landingPath: `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer || undefined,
    });
  }, [params.slug, sourceTrackingCode, trackSourceVisit]);

  useEffect(() => {
    if (!hasStarted || !sourceTrackingCode || !sourceVisitorId) return;
    const eventKey = `START:${sourceVisitorId}:${sourceTrackingCode}`;
    if (attributionEventsRef.current.has(eventKey)) return;
    attributionEventsRef.current.add(eventKey);
    trackSourceVisit.mutate({
      slug: params.slug,
      trackingCode: sourceTrackingCode,
      visitorId: sourceVisitorId,
      event: "START",
      landingPath: `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer || undefined,
    });
  }, [
    hasStarted,
    params.slug,
    sourceTrackingCode,
    sourceVisitorId,
    trackSourceVisit,
  ]);

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
    isCompleteDrawingResponses(drawingResponses);

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
    if (currentStep === 3) return true;
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
    currentStep,
    submitted,
  ]);

  function selectResume(file: File | undefined) {
    if (!file) return;
    setFileError("");

    const validationError = validateApplicationFile(file, "resume");
    if (validationError) {
      setFileError(validationError);
      return;
    }
    const attachedEvidenceFiles = applicationEvidence.artifacts.filter(
      (artifact) => artifact.file,
    ).length;
    if (!resumeFile && attachedEvidenceFiles >= MAX_APPLICATION_FILES) {
      setFileError(
        `You can attach up to ${MAX_APPLICATION_FILES} files to one application.`,
      );
      return;
    }

    setResumeFile({
      id: window.crypto.randomUUID(),
      file,
      skillNames: [],
    });
    setResumeFileName(file.name);
    setResumeUrl("");
  }

  async function uploadApplicationFile(
    session: ApplicationUploadSession,
    localFile: LocalApplicationFile,
    kind: ApplicationFileKind,
  ) {
    const formData = new FormData();
    formData.set("applicationId", session.applicationId);
    formData.set("token", session.fileUploadToken);
    formData.set("clientFileId", localFile.id);
    formData.set("kind", kind);
    formData.set("skillNames", JSON.stringify(localFile.skillNames));
    formData.set("file", localFile.file);

    const response = await fetch("/api/jobs/application-files", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok) {
      throw new Error(
        result?.error ?? "A file could not be uploaded. Please retry.",
      );
    }
  }

  function finishSubmission(session: ApplicationUploadSession) {
    setSubmittedApplicationId(session.applicationId);
    setPortfolioProvisioning(session.portfolioProvisioning);
    setSubmitted(true);
    setStep(steps.length - 1);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function goNext() {
    if (!canContinue) return;
    setStep((current) => Math.min(steps.length - 1, current + 1));
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function goBack() {
    if (currentStep === 0) {
      setHasStarted(false);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    setStep((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function startApplication() {
    setHasStarted(true);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (currentStep !== steps.length - 1) return;
    if (
      !canReuseDrawingAssessment &&
      !isCompleteDrawingResponses(drawingResponses)
    ) {
      setApplicationError(
        "Your Drawmetrics set is incomplete. Complete all ten drawings before reviewing your application.",
      );
      setStep(2);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    if (!job || submitted || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setFileError("");
    setApplicationError("");
    let session = uploadSession;

    try {
      if (!session) {
        const data = await apply.mutateAsync({
          slug: params.slug,
          portfolioUserId: skilioIdentity?.portfolioUserId,
          identityLinkId: skilioIdentity?.id,
          source: applyingWithSkilio ? "SKILIO" : "GUEST",
          sourceVisitorId: sourceVisitorId ?? undefined,
          name: name.trim(),
          email: email.trim(),
          phone: cleanOptionalText(
            [phoneCountryCode, phone.trim()].filter(Boolean).join(" "),
          ),
          location: cleanOptionalText(location),
          coverLetter: cleanOptionalText(coverLetter),
          evidence: {
            artifacts: serializedEvidence.artifacts,
            portfolioSkills: serializedEvidence.portfolioSkills,
          },
          portfolioEdits: serializedEvidence.portfolioEdits,
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
            profileId: profile?.id,
            organization: profile?.organization,
            authChoice: applyingWithSkilio ? "signed_in" : authChoice,
            screeningAnswers,
            resumeFileName,
            resumeUrl,
          },
        });
        session = {
          applicationId: data.id,
          fileUploadToken: data.fileUploadToken,
          portfolioProvisioning: null,
        };
        setUploadSession(session);
      }
      if (!session) {
        throw new Error("The application upload session could not be created.");
      }
      const activeUploadSession = session;

      await Promise.all([
        ...(resumeFile
          ? [uploadApplicationFile(activeUploadSession, resumeFile, "resume")]
          : []),
        ...applicationEvidence.artifacts
          .filter(
            (artifact): artifact is typeof artifact & { file: File } =>
              Boolean(artifact.file && confirmedArtifactSkills(artifact).length > 0),
          )
          .map((artifact) =>
            uploadApplicationFile(
              activeUploadSession,
              {
                id: artifact.id,
                file: artifact.file,
                skillNames: confirmedArtifactSkills(artifact).map((skill) => skill.name),
              },
              "skill_artifact",
            ),
          ),
      ]);
      const finalized = await finalizeEvidence.mutateAsync({
        applicationId: activeUploadSession.applicationId,
        fileUploadToken: activeUploadSession.fileUploadToken,
      });
      finishSubmission({
        ...activeUploadSession,
        portfolioProvisioning: finalized.portfolioProvisioning as PortfolioProvisioningView,
      });
    } catch (error) {
      if (session) {
        setFileError(
          error instanceof Error
            ? error.message
            : "A file could not be uploaded. Retry to finish your application.",
        );
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const applyNextSearch = new URLSearchParams({ stage: "access" });
  if (sourceTrackingCode) applyNextSearch.set("src", sourceTrackingCode);
  const applyNextPath = `/apply/${params.slug}?${applyNextSearch.toString()}`;
  const signInHref = `/auth/skilio/start?next=${encodeURIComponent(applyNextPath)}`;

  return (
    <main
      className={cn(
        "skilio-interface min-h-screen overflow-x-clip bg-[var(--skilio-panel)] text-[var(--skilio-ink)]",
        !hasStarted && !submitted && !jobUnavailable && "pb-24 lg:pb-0",
      )}
    >
      <header className="sticky top-0 z-20 border-b border-[var(--skilio-border)] bg-[var(--skilio-elevated)]">
        <div
          className={cn(
            "mx-auto flex h-16 items-center justify-between px-4 sm:px-6",
            !hasStarted && !submitted && !jobUnavailable
              ? "max-w-6xl"
              : "max-w-4xl",
          )}
        >
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

      <SkilioMotionRoot
        className={cn(
          "mx-auto w-full px-4 py-8 sm:px-6 sm:py-10",
          !hasStarted && !submitted && !jobUnavailable
            ? "max-w-6xl"
            : "max-w-4xl",
        )}
      >
        <div
          className={cn(
            !hasStarted && !submitted && !jobUnavailable
              ? "grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"
              : "contents",
          )}
        >
          <JobSummaryCard
            job={job}
            loading={jobQuery.isLoading}
            unavailable={jobUnavailable}
            compact={hasStarted || submitted}
          />

        {!hasStarted && !submitted && !jobUnavailable ? (
          <aside className="hidden lg:sticky lg:top-24 lg:block">
            {jobQuery.isLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : (
              <SkilioPanel className="border-[var(--skilio-border)] bg-[var(--skilio-elevated)] p-5 shadow-[var(--skilio-shadow-1)]">
                <h2 className="text-lg font-semibold text-[var(--skilio-ink)]">
                  Ready to apply?
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                  Start when you are ready. You can review your answers before
                  submitting.
                </p>
                <Button
                  type="button"
                  onClick={startApplication}
                  className="mt-5 h-11 w-full gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] px-5 text-white hover:bg-[var(--skilio-brand-strong)]"
                >
                  Start application
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </SkilioPanel>
            )}
          </aside>
        ) : (
          <section className="mt-6 min-w-0 space-y-6">
            {!submitted && !jobUnavailable && <StepRail current={currentStep} />}

            <SkilioPanel className="border-[var(--skilio-border)] bg-[var(--skilio-elevated)] p-5 shadow-none sm:p-7">
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
                {portfolioProvisioning?.status === "CREATED" && (
                  <div className="mt-5 w-full rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] p-4 text-left">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--skilio-brand)]" />
                      <div>
                        <div className="font-semibold text-[var(--skilio-ink)]">
                          Your Skilio profile is ready to activate
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                          {portfolioProvisioning.activationEmailSent
                            ? "Use the verification code sent to your email to choose a password."
                            : "Open Skilio to request a verification code and choose a password."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {portfolioProvisioning?.status === "EXISTING_ACCOUNT" && (
                  <div className="mt-5 w-full rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] p-4 text-left">
                    <div className="font-semibold text-[var(--skilio-ink)]">
                      {applyingWithSkilio
                        ? portfolioProvisioning.skillsAdded
                          ? `${portfolioProvisioning.skillsAdded} new skill${portfolioProvisioning.skillsAdded === 1 ? "" : "s"} added to your portfolio`
                          : "Your portfolio skills are up to date"
                        : "You already have a Skilio account"}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                      {applyingWithSkilio
                        ? "Skills confirmed in this application are now available on your Skilio portfolio."
                        : "Sign in with the same email to continue building your portfolio."}
                    </p>
                  </div>
                )}
                {portfolioProvisioning?.status === "FAILED" && (
                  <div
                    role="alert"
                    className="mt-5 w-full rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] p-4 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--skilio-danger)]" />
                      <div>
                        <div className="font-semibold text-[var(--skilio-ink)]">
                          Account setup needs another attempt
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                          Your application is safely submitted. Retry only the
                          Skilio portfolio sync.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            retryProvisioning.isLoading ||
                            !submittedApplicationId
                          }
                          onClick={() =>
                            retryProvisioning.mutate({
                              applicationId: submittedApplicationId,
                              email,
                            })
                          }
                          className="mt-3 gap-2 border-[var(--skilio-border-strong)]"
                        >
                          {retryProvisioning.isLoading && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          Retry account setup
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <Button
                  asChild
                  className="mt-6 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
                >
                  <a
                    href={
                      applyingWithSkilio
                        ? profileUrl
                        : portfolioProvisioning?.nextUrl || profileUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {portfolioProvisioning?.status === "CREATED"
                      ? "Activate Skilio account"
                      : portfolioProvisioning?.status === "EXISTING_ACCOUNT"
                        ? applyingWithSkilio
                          ? "Open Skilio portfolio"
                          : "Sign in to Skilio"
                        : "Open Skilio portfolio"}
                  </a>
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-6">
                {applicationError && (
                  <div
                    role="alert"
                    className="rounded-[var(--skilio-radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {applicationError}
                  </div>
                )}
                {currentStep === 0 && (
                  <div className="space-y-5">
                    <div>
                      <div className="text-xs font-medium text-[var(--skilio-ink-muted)]">
                        Application access
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold text-[var(--skilio-ink)]">
                        Choose how to apply
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--skilio-ink-soft)]">
                        Use your Skilio profile to bring in verified details, or
                        enter the application manually.
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)]">
                      {applyingWithSkilio ? (
                        <button
                          type="button"
                          onClick={() => setAuthChoice("skilio")}
                          className="flex min-h-[76px] w-full items-center justify-between gap-4 bg-[var(--skilio-elevated)] px-4 py-3 text-left transition-colors hover:bg-[var(--skilio-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--skilio-brand)]"
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                                authChoice === "skilio"
                                  ? "border-[var(--skilio-brand)] bg-[var(--skilio-brand)] text-white"
                                  : "border-[var(--skilio-border-strong)] text-transparent",
                              )}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                            <span>
                              <span className="block text-sm font-semibold text-[var(--skilio-ink)]">
                                Use your Skilio profile
                              </span>
                              <span className="mt-0.5 block text-sm text-[var(--skilio-ink-soft)]">
                                We will reuse your verified profile, CV, skills, and evidence.
                              </span>
                            </span>
                          </span>
                          <span className="hidden shrink-0 text-xs font-medium text-[var(--skilio-brand-strong)] sm:block">
                            Signed in
                          </span>
                        </button>
                      ) : (
                        <a
                          href={signInHref}
                          className="flex min-h-[76px] items-center justify-between gap-4 bg-[var(--skilio-elevated)] px-4 py-3 text-left transition-colors hover:bg-[var(--skilio-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--skilio-brand)]"
                        >
                          <span className="flex items-center gap-3">
                            <LogIn className="h-5 w-5 shrink-0 text-[var(--skilio-brand)]" />
                            <span>
                              <span className="block text-sm font-semibold text-[var(--skilio-ink)]">
                                Sign in with Skilio
                              </span>
                              <span className="mt-0.5 block text-sm text-[var(--skilio-ink-soft)]">
                                Reuse your verified profile and contact information.
                              </span>
                            </span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-[var(--skilio-ink-muted)]" />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setAuthChoice("guest")}
                        className={cn(
                          "flex min-h-[76px] w-full items-center justify-between gap-4 border-t border-[var(--skilio-border)] px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--skilio-brand)]",
                          authChoice === "guest"
                            ? "bg-[var(--skilio-control)]"
                            : "bg-[var(--skilio-elevated)] hover:bg-[var(--skilio-control)]",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                              authChoice === "guest"
                                ? "border-[var(--skilio-brand)] bg-[var(--skilio-brand)] text-white"
                                : "border-[var(--skilio-border-strong)] text-transparent",
                            )}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-[var(--skilio-ink)]">
                              Continue manually
                            </span>
                            <span className="mt-0.5 block text-sm text-[var(--skilio-ink-soft)]">
                              Fill the application now. Submission automatically creates and saves your Skilio portfolio.
                            </span>
                          </span>
                        </span>
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
                      {applyingManually && (
                        <div className="flex items-start gap-3 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-control)] p-4 md:col-span-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--skilio-brand)]" />
                          <div>
                            <p className="text-sm font-semibold text-[var(--skilio-ink)]">Your application also becomes your Skilio portfolio</p>
                            <p className="mt-1 text-sm leading-6 text-[var(--skilio-ink-soft)]">When you submit, we automatically create a Skilio portfolio with the profile details, skills, and evidence you confirmed. If this email already has a portfolio, we will ask you to sign in before adding evidence to it.</p>
                          </div>
                        </div>
                      )}
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
                        You will be presented with a series of symbols. Draw the
                        first thing that comes to mind when you see each symbol,
                        then describe what you drew in three words or fewer.
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
                        onChange={(responses) => {
                          setDrawingResponses(responses);
                          if (isCompleteDrawingResponses(responses)) {
                            setApplicationError("");
                          }
                        }}
                      />
                    )}
                  </div>
                )}

                {currentStep === 3 && (
                  <div>
                    <ApplicationSkillsSignal
                      jobSlug={params.slug}
                      jobSkills={job?.job_skills ?? []}
                      isPortfolioApplicant={applyingWithSkilio}
                      portfolioSkills={skilioPortfolioSkills}
                      evidence={applicationEvidence}
                      setEvidence={setApplicationEvidence}
                      resumeAttached={Boolean(resumeFile)}
                      onError={setFileError}
                      onConfirmedLink={(url) => {
                          if (!website.trim()) setWebsite(url);
                        }}
                      onSkip={goNext}
                    />
                    {fileError && (
                      <p
                        role="alert"
                        className="mt-4 text-sm font-medium text-[var(--skilio-danger)]"
                      >
                        {fileError}
                      </p>
                    )}
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
                            selectResume(event.target.files?.[0]);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {resumeFile && (
                        <div className="mt-2 flex items-center justify-between gap-3 rounded-[var(--skilio-radius-sm)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] px-3 py-2">
                          <span className="min-w-0 truncate text-sm font-medium text-[var(--skilio-ink)]">
                            {resumeFile.file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setResumeFile(null);
                              setResumeFileName("");
                              setFileError("");
                            }}
                            aria-label={`Remove ${resumeFile.file.name}`}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--skilio-radius-sm)] text-[var(--skilio-ink-muted)] hover:bg-[var(--skilio-elevated)] hover:text-[var(--skilio-danger)]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      {fileError && (
                        <p
                          role="alert"
                          className="mt-2 text-sm font-medium text-[var(--skilio-danger)]"
                        >
                          {fileError}
                        </p>
                      )}
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
                          {serializedEvidence.skillNames.map((skill) => (
                            <Badge key={skill} className="rounded-md bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)] hover:bg-[var(--skilio-control-strong)]">
                              {skill}
                            </Badge>
                          ))}
                          {serializedEvidence.skillNames.length === 0 && (
                            <span className="text-sm text-[var(--skilio-ink-muted)]">No skills evidence selected</span>
                          )}
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
                    {getApplicationErrorMessage(apply.error?.message)}
                  </div>
                )}
                {fileError && currentStep >= 5 && (
                  <div
                    role="alert"
                    className="rounded-[var(--skilio-radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    <div className="font-semibold">
                      {uploadSession
                        ? "Your application was saved, but its files still need to finish uploading."
                        : "One or more attached files needs attention."}
                    </div>
                    <p className="mt-1">{fileError}</p>
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-[var(--skilio-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    disabled={isSubmitting}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {currentStep === 0 ? "Job details" : "Back"}
                  </Button>
                  {currentStep < steps.length - 1 ? (
                    <Button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        goNext();
                      }}
                      disabled={!canContinue}
                      className="gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
                    >
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
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
                    >
                      {isSubmitting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {uploadSession
                        ? "Retry file uploads"
                        : isSubmitting
                          ? "Submitting application"
                          : "Submit application"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </form>
            )}
            </SkilioPanel>
          </section>
        )}
        </div>
      </SkilioMotionRoot>

      {!hasStarted && !submitted && !jobUnavailable && !jobQuery.isLoading && (
        <div
          data-testid="application-floating-cta"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--skilio-border)] bg-[var(--skilio-elevated)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[var(--skilio-shadow-2)] lg:hidden"
        >
          <div className="mx-auto max-w-4xl">
            <Button
              type="button"
              onClick={startApplication}
              className="h-11 w-full gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] px-5 text-white hover:bg-[var(--skilio-brand-strong)]"
            >
              Start application
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
