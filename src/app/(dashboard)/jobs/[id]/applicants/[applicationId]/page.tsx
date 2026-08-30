"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileText,
  FileVideo,
  Link2,
  ListChecks,
  Mail,
  MapPin,
  MessageSquareText,
  Paperclip,
  Phone,
  Save,
  Shapes,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ApplicantStatusBadge } from "@/components/jobs/applicant-status-badge";
import {
  APPLICANT_REVIEW_TIERS,
  type ApplicantReviewTier,
} from "@/components/jobs/applicant-tier-badge";
import { EmployerPageHeader } from "@/components/jobs/employer-page";
import { SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { parseApplicationDrawingAssessment } from "@/lib/drawing-assessment";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type JsonRecord = Record<string, unknown>;

type ApplicantFile = {
  id: string;
  kind: string;
  fileName: string;
  fileType?: string | null;
  fileSize?: number | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  skillNames?: unknown;
  url?: string | null;
};

type ApplicantDetail = {
  id: string;
  jobId: string;
  portfolioUserId?: string | null;
  source: string | null;
  applicationMethod?: string | null;
  job_source_links?: {
    name: string;
    channel: string;
  } | null;
  status: string;
  reviewTier?: ApplicantReviewTier | null;
  reviewNotes?: string | null;
  reviewNotesUpdatedAt?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  bio?: string | null;
  coverLetter?: string | null;
  profileSnapshot?: JsonRecord;
  screeningAnswers?: JsonRecord;
  skillsSnapshot?: unknown;
  links?: JsonRecord;
  matchScore: number | null;
  submittedAt?: string;
  job_postings?: {
    id: string;
    title: string;
    status: string;
    department?: string | null;
    location?: string | null;
    employmentType?: string | null;
    seniority?: string | null;
    screeningQuestions?: {
      id: string;
      prompt: string;
      type: string;
      required: boolean;
      options: string[];
    }[];
    job_skills?: {
      id: string;
      name: string;
      priority: string;
    }[];
  };
  job_application_files?: ApplicantFile[];
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function firstText(...values: unknown[]) {
  return values.map(asString).find(Boolean) ?? "";
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function DecisionButton({
  active,
  children,
  disabled,
  onClick,
  tone,
}: {
  active: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone: "reviewed" | "accepted" | "rejected";
}) {
  const activeTone = {
    reviewed:
      "border-[var(--skilio-ink)] bg-[var(--skilio-ink)] text-white hover:bg-[var(--skilio-ink)]",
    accepted:
      "border-[var(--skilio-brand)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]",
    rejected:
      "border-[var(--skilio-danger)] bg-[var(--skilio-danger)] text-white hover:bg-[var(--skilio-danger)]",
  }[tone];

  return (
    <Button
      variant="outline"
      className={cn(
        "h-10 justify-start gap-2 rounded-[var(--skilio-radius-md)]",
        active
          ? activeTone
          : tone === "rejected"
            ? "border-red-200 text-[var(--skilio-danger)] hover:bg-[var(--skilio-danger-soft)]"
            : "border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink-soft)] hover:bg-[var(--skilio-control)]",
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function DetailLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-b border-[var(--skilio-border)] py-3 last:border-b-0">
      <Icon className="mt-0.5 h-4 w-4 text-[var(--skilio-brand)]" />
      <div className="min-w-0">
        <div className="text-xs text-[var(--skilio-ink-muted)]">{label}</div>
        <div className="mt-1 break-words text-sm font-medium text-[var(--skilio-ink)]">
          {value || "-"}
        </div>
      </div>
    </div>
  );
}

function ExternalLinkRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-10 items-center justify-between gap-3 rounded-[var(--skilio-radius-sm)] border border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] px-3 py-2 text-sm font-medium text-[var(--skilio-ink)] transition-colors hover:bg-[var(--skilio-control)] hover:text-[var(--skilio-brand)]"
    >
      <span>{label}</span>
      <ExternalLink className="h-4 w-4 shrink-0" />
    </a>
  );
}

function StoredFileLink({ file }: { file: ApplicantFile }) {
  if (!file.url) {
    return (
      <div className="rounded-[var(--skilio-radius-sm)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] px-3 py-2">
        <div className="break-words text-sm font-medium text-[var(--skilio-ink)]">
          {file.fileName}
        </div>
        <div className="mt-1 text-xs text-[var(--skilio-danger)]">
          File unavailable
        </div>
      </div>
    );
  }

  const isMp4 =
    file.fileType?.toLowerCase() === "video/mp4" ||
    file.fileName.toLowerCase().endsWith(".mp4");

  if (isMp4) {
    return (
      <div className="overflow-hidden rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)]">
        <video
          controls
          preload="metadata"
          className="aspect-video w-full bg-[var(--skilio-ink)] object-contain"
          aria-label={`Video artefact: ${file.fileName}`}
        >
          <source src={file.url} type="video/mp4" />
        </video>
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-[var(--skilio-ink)] transition-colors hover:bg-[var(--skilio-control)] hover:text-[var(--skilio-brand)]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <FileVideo className="h-4 w-4 shrink-0 text-[var(--skilio-brand)]" />
            <span className="break-all">{file.fileName}</span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0" />
        </a>
      </div>
    );
  }

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-10 items-center justify-between gap-3 rounded-[var(--skilio-radius-sm)] border border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] px-3 py-2 text-sm font-medium text-[var(--skilio-ink)] transition-colors hover:bg-[var(--skilio-control)] hover:text-[var(--skilio-brand)]"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Paperclip className="h-4 w-4 shrink-0 text-[var(--skilio-brand)]" />
        <span className="break-all">{file.fileName}</span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0" />
    </a>
  );
}

function LegacyFileRow({
  fileName,
  url,
}: {
  fileName: string;
  url?: string;
}) {
  if (url) {
    return (
      <ExternalLinkRow label={fileName} value={url} />
    );
  }

  return (
    <div className="rounded-[var(--skilio-radius-sm)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] px-3 py-2">
      <div className="break-words text-sm font-medium text-[var(--skilio-ink)]">
        {fileName}
      </div>
      <p className="mt-1 text-xs leading-5 text-[var(--skilio-ink-muted)]">
        File unavailable — this legacy application stored the filename only.
      </p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b border-[var(--skilio-border)] py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="text-xs font-medium text-[var(--skilio-ink-muted)]">{label}</div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--skilio-ink)]">
        {value || "No response provided."}
      </p>
    </div>
  );
}

function EvidenceLink({ item }: { item: JsonRecord }) {
  const label = firstText(item.description, item.title, item.fileName, item.name, item.url, item.fileUrl);
  const url = firstText(item.url, item.fileUrl);
  if (!label) return null;
  if (!url) {
    return <li className="text-sm text-[var(--skilio-ink-soft)]">{label}</li>;
  }
  return (
    <li>
      <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-[var(--skilio-brand)] hover:underline">
        {label}
      </a>
    </li>
  );
}

export default function ApplicantReviewPage() {
  const params = useParams<{ id: string; applicationId: string }>();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [reviewTier, setReviewTier] = useState<ApplicantReviewTier | "UNRANKED">(
    "UNRANKED",
  );
  const [reviewNotes, setReviewNotes] = useState("");
  const applicationQuery = trpc.job.getApplicationById.useQuery({ id: params.applicationId });
  const updateStatus = trpc.job.updateApplicationStatus.useMutation({
    onSuccess: async () => {
      await utils.job.getApplicationById.invalidate({ id: params.applicationId });
      await utils.job.getById.invalidate({ id: params.id });
      await utils.job.applications.invalidate();
      toast({ title: "Applicant status updated" });
    },
    onError: (error) => {
      toast({
        title: "Applicant status was not updated",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  const updateReview = trpc.job.updateApplicationReview.useMutation({
    onSuccess: async (data) => {
      setReviewTier(
        (data.reviewTier as ApplicantReviewTier | null) ?? "UNRANKED",
      );
      setReviewNotes(data.reviewNotes ?? "");
      await utils.job.getApplicationById.invalidate({ id: params.applicationId });
      await utils.job.getById.invalidate({ id: params.id });
      await utils.job.applications.invalidate();
      toast({ title: "Review notes saved" });
    },
    onError: (error) => {
      toast({
        title: "Review notes were not saved",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const applicant = applicationQuery.data as ApplicantDetail | undefined;
  const persistedReviewTier = applicant?.reviewTier ?? "UNRANKED";
  const persistedReviewNotes = applicant?.reviewNotes ?? "";
  useEffect(() => {
    if (!applicant?.id) return;
    setReviewTier(persistedReviewTier);
    setReviewNotes(persistedReviewNotes);
  }, [applicant?.id, persistedReviewNotes, persistedReviewTier]);

  const profileSnapshot = asRecord(applicant?.profileSnapshot);
  const portfolioSnapshot = asRecord(profileSnapshot.portfolioSnapshot);
  const links = asRecord(applicant?.links);
  const screeningAnswers = asRecord(applicant?.screeningAnswers);
  const skillEvidence = asRecord(profileSnapshot.skillEvidence);
  const portfolioEvidence = asRecordArray(portfolioSnapshot.skillEvidence);
  const applicationEvidence = asRecordArray(profileSnapshot.evidenceSources);
  const skills = asStringArray(applicant?.skillsSnapshot);
  const resumeName = firstText(profileSnapshot.resumeFileName);
  const resumeUrl = firstText(profileSnapshot.resumeUrl, links.resume);
  const certificateFileNames = asStringArray(profileSnapshot.certificateFileNames);
  const drawingAssessment = parseApplicationDrawingAssessment(
    profileSnapshot.drawingAssessment,
  );
  const drawingAssessmentReused =
    profileSnapshot.drawingAssessmentReused === true;
  const submittedProfileSnapshot = drawingAssessment
    ? {
        ...profileSnapshot,
        drawingAssessment: {
          ...drawingAssessment,
          responses: drawingAssessment.responses.map((response) => ({
            ...response,
            imageDataUrl: "[PNG screenshot stored]",
          })),
        },
      }
    : profileSnapshot;
  const files = applicant?.job_application_files ?? [];
  const hasStoredResume = files.some(
    (file) =>
      file.kind === "resume" &&
      (!resumeName ||
        file.fileName.trim().toLowerCase() ===
          resumeName.trim().toLowerCase()),
  );
  function setStatus(status: "REVIEWED" | "SHORTLISTED" | "REJECTED") {
    if (!applicant) return;
    updateStatus.mutate({ id: applicant.id, status });
  }

  const hasReviewChanges = Boolean(
    applicant &&
      (reviewTier !== persistedReviewTier || reviewNotes !== persistedReviewNotes),
  );

  function saveReview() {
    if (!applicant || !hasReviewChanges) return;
    updateReview.mutate({
      id: applicant.id,
      reviewTier: reviewTier === "UNRANKED" ? null : reviewTier,
      reviewNotes,
    });
  }

  return (
    <SkilioMotionRoot className="mx-auto flex max-w-7xl flex-col gap-6">
      <Link
        href={`/jobs/${params.id}?tab=applicants`}
        className="inline-flex min-h-10 w-fit items-center gap-2 text-sm font-medium text-[var(--skilio-ink-soft)] hover:text-[var(--skilio-brand)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to job
      </Link>

      {applicationQuery.isLoading || !applicant ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <>
          <EmployerPageHeader
            title={applicant.name}
            description={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <ApplicantStatusBadge status={applicant.status} />
                <span>{applicant.job_postings?.title ?? "Application"}</span>
                <span aria-hidden="true">/</span>
                <span>Submitted {formatDate(applicant.submittedAt)}</span>
              </span>
            }
          />

          <SkilioPanel className="p-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs font-medium text-[var(--skilio-ink-muted)]">
                    Match score
                  </div>
                  <div className="mt-1 font-heading text-3xl font-semibold tabular-nums text-[var(--skilio-ink)]">
                    N/A
                  </div>
                </div>
                <div className="border-l border-[var(--skilio-border)] pl-6">
                  <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                    Hiring decision
                  </h2>
                  <p className="mt-1 text-sm text-[var(--skilio-ink-muted)]">
                    Review the submitted skills and evidence below.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <DecisionButton
                  active={applicant.status === "REVIEWED"}
                  tone="reviewed"
                  disabled={updateStatus.isLoading}
                  onClick={() => setStatus("REVIEWED")}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Mark reviewed
                </DecisionButton>
                <DecisionButton
                  active={applicant.status === "SHORTLISTED"}
                  tone="accepted"
                  disabled={updateStatus.isLoading}
                  onClick={() => setStatus("SHORTLISTED")}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Accept
                </DecisionButton>
                <DecisionButton
                  active={applicant.status === "REJECTED"}
                  tone="rejected"
                  disabled={updateStatus.isLoading}
                  onClick={() => setStatus("REJECTED")}
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </DecisionButton>
              </div>
            </div>
          </SkilioPanel>

          <SkilioPanel className="p-5">
            <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-5 w-5 text-[var(--skilio-brand)]" />
                  <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                    Review notes
                  </h2>
                </div>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--skilio-ink-muted)]">
                  Rank this applicant independently from the hiring decision and
                  keep context for future review. These notes are only visible to
                  your hiring workspace.
                </p>
                <div className="mt-4">
                  <Label htmlFor="applicant-review-tier">Applicant tier</Label>
                  <Select
                    value={reviewTier}
                    onValueChange={(value) =>
                      setReviewTier(value as ApplicantReviewTier | "UNRANKED")
                    }
                    disabled={updateReview.isLoading}
                  >
                    <SelectTrigger
                      id="applicant-review-tier"
                      className="mt-2 bg-[var(--skilio-control)]"
                    >
                      <SelectValue placeholder="Choose a tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNRANKED">Unranked</SelectItem>
                      {APPLICANT_REVIEW_TIERS.map((tier) => (
                        <SelectItem key={tier.value} value={tier.value}>
                          <span className="flex items-baseline gap-2">
                            <span>{tier.label}</span>
                            <span className="text-xs text-[var(--skilio-ink-muted)]">
                              {tier.description}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="applicant-review-notes">Internal comment</Label>
                  <span className="text-xs tabular-nums text-[var(--skilio-ink-muted)]">
                    {reviewNotes.length} / 4,000
                  </span>
                </div>
                <Textarea
                  id="applicant-review-notes"
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  maxLength={4000}
                  disabled={updateReview.isLoading}
                  placeholder="Add observations, follow-up questions, or reasons for this ranking…"
                  className="mt-2 min-h-32 resize-y border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] text-[var(--skilio-ink)] placeholder:text-[var(--skilio-ink-muted)] focus-visible:ring-[var(--skilio-brand)]"
                />
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    className={cn(
                      "text-xs",
                      hasReviewChanges
                        ? "font-medium text-[var(--skilio-ink)]"
                        : "text-[var(--skilio-ink-muted)]",
                    )}
                    aria-live="polite"
                  >
                    {updateReview.isLoading
                      ? "Saving review…"
                      : hasReviewChanges
                        ? "Unsaved changes"
                        : applicant.reviewNotesUpdatedAt
                          ? `Saved ${formatDate(applicant.reviewNotesUpdatedAt)}`
                          : "No review notes saved yet"}
                  </p>
                  <Button
                    type="button"
                    onClick={saveReview}
                    disabled={!hasReviewChanges || updateReview.isLoading}
                    className="w-full bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)] sm:w-auto"
                  >
                    <Save className="h-4 w-4" />
                    {updateReview.isLoading ? "Saving…" : "Save review"}
                  </Button>
                </div>
              </div>
            </div>
          </SkilioPanel>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <SkilioPanel className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-[var(--skilio-brand)]" />
                  <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                    Candidate profile
                  </h2>
                </div>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <DetailLine icon={Mail} label="Email" value={applicant.email} />
                  <DetailLine icon={Phone} label="Phone" value={applicant.phone} />
                  <DetailLine icon={MapPin} label="Location" value={applicant.location} />
                  <DetailLine
                    icon={Briefcase}
                    label="Source"
                    value={applicant.job_source_links?.name ?? "Direct"}
                  />
                  <DetailLine
                    icon={UserRound}
                    label="Application method"
                    value={
                      applicant.applicationMethod === "SKILIO"
                        ? "Skilio account"
                        : "Manual application"
                    }
                  />
                </div>
              </SkilioPanel>

              <SkilioPanel className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[var(--skilio-brand)]" />
                  <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                    Application statement
                  </h2>
                </div>
                <TextBlock
                  label="Why this role"
                  value={applicant.coverLetter}
                />
              </SkilioPanel>

              <SkilioPanel className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-[var(--skilio-brand)]" />
                  <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                    Pre-screening questions
                  </h2>
                </div>
                {(applicant.job_postings?.screeningQuestions ?? []).length ===
                0 ? (
                  <p className="text-sm text-[var(--skilio-ink-soft)]">
                    No pre-screening questions were included for this role.
                  </p>
                ) : (
                  <div>
                    {(applicant.job_postings?.screeningQuestions ?? []).map(
                      (question) => (
                        <TextBlock
                          key={question.id}
                          label={question.prompt}
                          value={asString(screeningAnswers[question.id])}
                        />
                      ),
                    )}
                  </div>
                )}
              </SkilioPanel>

              <SkilioPanel className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[var(--skilio-brand)]" />
                  <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                    Skills and portfolio
                  </h2>
                </div>
                {skills.length === 0 ? (
                  <p className="text-sm text-[var(--skilio-ink-soft)]">
                    No skills were submitted.
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--skilio-border)]">
                    {skills.map((skill) => {
                      const portfolioItem = portfolioEvidence.find(
                        (item) => firstText(item.name).toLowerCase() === skill.toLowerCase(),
                      );
                      const proofs = asRecordArray(portfolioItem?.proofs);
                      const videos = asRecordArray(portfolioItem?.videos);
                      const submittedLinks = applicationEvidence.filter(
                        (item) =>
                          Boolean(firstText(item.url)) &&
                          asStringArray(item.skills).some(
                            (itemSkill) =>
                              itemSkill.trim().toLowerCase() ===
                              skill.trim().toLowerCase(),
                          ),
                      );
                      const attachedFiles = files.filter(
                        (file) =>
                          file.kind === "skill_artifact" &&
                          asStringArray(file.skillNames).some(
                            (fileSkill) =>
                              fileSkill.trim().toLowerCase() ===
                              skill.trim().toLowerCase(),
                          ),
                      );
                      return (
                        <div
                          key={skill}
                          className="py-4 first:pt-0 last:pb-0"
                        >
                          <div className="font-semibold text-[var(--skilio-ink)]">
                            {skill}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--skilio-ink-soft)]">
                            {asString(skillEvidence[skill]) || "No written evidence provided."}
                          </p>
                          {(proofs.length > 0 || videos.length > 0) && (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              {proofs.length > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-[var(--skilio-ink-muted)]">
                                    Portfolio proofs
                                  </div>
                                  <ul className="mt-2 list-disc space-y-1 pl-4">
                                    {proofs.map((proof, index) => <EvidenceLink key={index} item={proof} />)}
                                  </ul>
                                </div>
                              )}
                              {videos.length > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-[var(--skilio-ink-muted)]">
                                    Portfolio videos
                                  </div>
                                  <ul className="mt-2 list-disc space-y-1 pl-4">
                                    {videos.map((video, index) => <EvidenceLink key={index} item={video} />)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                          {submittedLinks.length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs font-medium text-[var(--skilio-ink-muted)]">
                                Application evidence links
                              </div>
                              <ul className="mt-2 list-disc space-y-1 pl-4">
                                {submittedLinks.map((item, index) => (
                                  <EvidenceLink key={firstText(item.id) || index} item={item} />
                                ))}
                              </ul>
                            </div>
                          )}
                          {attachedFiles.length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs font-medium text-[var(--skilio-ink-muted)]">
                                Attached artefacts
                              </div>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {attachedFiles.map((file) => (
                                  <StoredFileLink key={file.id} file={file} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </SkilioPanel>

              <SkilioPanel className="p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Shapes className="h-5 w-5 text-[var(--skilio-brand)]" />
                    <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                      Drawmetrics results
                    </h2>
                  </div>
                  {drawingAssessment && (
                    <div className="flex flex-wrap items-center gap-2">
                      {drawingAssessmentReused && (
                        <Badge
                          variant="outline"
                          className="rounded-md border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] text-[var(--skilio-ink-soft)]"
                        >
                          Reused within 1 year
                        </Badge>
                      )}
                      <Badge className="rounded-md bg-[var(--skilio-control-strong)] text-[var(--skilio-brand-strong)] hover:bg-[var(--skilio-control-strong)]">
                        Score N/A
                      </Badge>
                    </div>
                  )}
                </div>
                {!drawingAssessment ? (
                  <div className="border-t border-[var(--skilio-border)] pt-4">
                    <div className="font-semibold text-[var(--skilio-ink)]">
                      No Drawmetrics set attached
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                      This application was submitted before Drawmetrics was
                      required.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="mb-4 text-sm text-[var(--skilio-ink-soft)]">
                      Ten candidate drawings completed{" "}
                      {formatDate(drawingAssessment.completedAt)}. Scoring is
                      not available yet.
                    </p>
                    <div
                      data-testid="applicant-drawmetrics-gallery"
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      {drawingAssessment.responses.map((response, index) => (
                        <article
                          key={response.starterShape}
                          className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-3"
                        >
                          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--skilio-radius-sm)] bg-white shadow-[inset_0_0_0_1px_rgba(16,38,28,0.08)]">
                            <Image
                              src={response.imageDataUrl}
                              alt={`Drawing ${index + 1}: ${response.phrase}`}
                              fill
                              unoptimized
                              className="object-contain"
                            />
                          </div>
                          <div className="min-w-0 py-1">
                            <div className="text-[11px] font-semibold uppercase text-[var(--skilio-ink-muted)]">
                              Drawing {index + 1}
                            </div>
                            <div className="mt-2 break-words text-sm font-semibold text-[var(--skilio-ink)]">
                              {response.phrase}
                            </div>
                            <div className="mt-1 text-xs capitalize text-[var(--skilio-ink-soft)]">
                              {response.starterShape.toLowerCase()}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </SkilioPanel>
            </div>

            <aside className="lg:sticky lg:top-20">
              <SkilioPanel>
                <section className="p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-[var(--skilio-brand)]" />
                    <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                      Candidate files
                    </h2>
                  </div>
                  <div className="grid gap-2">
                    <ExternalLinkRow
                      label="Skilio portfolio"
                      value={asString(links.portfolio)}
                    />
                    <ExternalLinkRow
                      label="LinkedIn"
                      value={asString(links.linkedin)}
                    />
                    <ExternalLinkRow label="GitHub" value={asString(links.github)} />
                    <ExternalLinkRow
                      label="Website"
                      value={asString(links.website)}
                    />
                    {!asString(links.portfolio) &&
                      !asString(links.linkedin) &&
                      !asString(links.github) &&
                      !asString(links.website) && (
                        <p className="text-sm text-[var(--skilio-ink-soft)]">
                          No profile links were attached.
                        </p>
                      )}
                  </div>
                </section>

                <section className="border-t border-[var(--skilio-border)] p-5">
                  <h3 className="font-semibold text-[var(--skilio-ink)]">
                    Attachments
                  </h3>
                  <div className="mt-3 space-y-2">
                    {resumeName && !hasStoredResume && (
                      <LegacyFileRow fileName={resumeName} url={resumeUrl} />
                    )}
                    {certificateFileNames.map((fileName) => (
                      <LegacyFileRow
                        key={fileName}
                        fileName={fileName}
                      />
                    ))}
                    {files.map((file) => (
                      <div key={file.id}>
                        <StoredFileLink file={file} />
                        <div className="mt-1 px-1 text-xs capitalize text-[var(--skilio-ink-muted)]">
                          {file.kind.replaceAll("_", " ")}
                        </div>
                      </div>
                    ))}
                    {!resumeName &&
                      certificateFileNames.length === 0 &&
                      files.length === 0 && (
                        <p className="text-sm text-[var(--skilio-ink-soft)]">
                          No file names were attached.
                        </p>
                      )}
                  </div>
                </section>

                <section className="border-t border-[var(--skilio-border)] p-5">
                  <h3 className="font-semibold text-[var(--skilio-ink)]">
                    Application record
                  </h3>
                  <details className="mt-3 rounded-[var(--skilio-radius-sm)] border border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] p-3">
                    <summary className="cursor-pointer text-sm font-medium text-[var(--skilio-ink)]">
                      Full profile snapshot
                    </summary>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-[var(--skilio-ink-soft)]">
                      {JSON.stringify(submittedProfileSnapshot, null, 2)}
                    </pre>
                  </details>
                </section>
              </SkilioPanel>
            </aside>
          </div>
        </>
      )}
    </SkilioMotionRoot>
  );
}
