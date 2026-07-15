"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileText,
  Link2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { SkilioHero, SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type JsonRecord = Record<string, unknown>;

type ApplicantDetail = {
  id: string;
  jobId: string;
  portfolioUserId?: string | null;
  source: string | null;
  status: string;
  name: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  bio?: string | null;
  coverLetter?: string | null;
  profileSnapshot?: JsonRecord;
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
  };
  job_application_files?: {
    id: string;
    kind: string;
    fileName: string;
    fileType?: string | null;
    fileSize?: number | null;
  }[];
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

function formatStatus(status: string) {
  return status === "SHORTLISTED" ? "accepted" : status.toLowerCase();
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function DecisionButton({
  active,
  children,
  className,
  disabled,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className={cn(
        "h-10 justify-start gap-2 rounded-[var(--skilio-radius-md)]",
        active && "border-[#2f7d4f] bg-[#e6f6df] text-[#24533b] hover:bg-[#e6f6df]",
        className,
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
    <div className="flex items-start gap-3 rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-3">
      <Icon className="mt-0.5 h-4 w-4 text-[#2f7d4f]" />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#66765f]">{label}</div>
        <div className="mt-1 break-words text-sm font-medium text-[#14213d]">{value || "-"}</div>
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
      className="flex items-center justify-between gap-3 rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] px-3 py-2 text-sm font-medium text-[#14213d] transition hover:border-[#b9dcb0] hover:text-[#2f7d4f]"
    >
      <span>{label}</span>
      <ExternalLink className="h-4 w-4 shrink-0" />
    </a>
  );
}

function TextBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#66765f]">{label}</div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#14213d]">
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
    return <li className="text-sm text-[#4b596d]">{label}</li>;
  }
  return (
    <li>
      <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#24533b] hover:underline">
        {label}
      </a>
    </li>
  );
}

export default function ApplicantReviewPage() {
  const params = useParams<{ id: string; applicationId: string }>();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const applicationQuery = trpc.job.getApplicationById.useQuery({ id: params.applicationId });
  const updateStatus = trpc.job.updateApplicationStatus.useMutation({
    onSuccess: async () => {
      await utils.job.getApplicationById.invalidate({ id: params.applicationId });
      await utils.job.getById.invalidate({ id: params.id });
      await utils.job.applications.invalidate();
      toast({ title: "Applicant status updated" });
    },
  });

  const applicant = applicationQuery.data as ApplicantDetail | undefined;
  const profileSnapshot = asRecord(applicant?.profileSnapshot);
  const portfolioSnapshot = asRecord(profileSnapshot.portfolioSnapshot);
  const links = asRecord(applicant?.links);
  const skillEvidence = asRecord(profileSnapshot.skillEvidence);
  const skillConfidence = asRecord(profileSnapshot.skillConfidence);
  const portfolioEvidence = asRecordArray(portfolioSnapshot.skillEvidence);
  const skills = asStringArray(applicant?.skillsSnapshot);
  const resumeName = firstText(profileSnapshot.resumeFileName);
  const resumeUrl = firstText(profileSnapshot.resumeUrl, links.resume);
  const certificateFileNames = asStringArray(profileSnapshot.certificateFileNames);
  const files = applicant?.job_application_files ?? [];

  function setStatus(status: "REVIEWED" | "SHORTLISTED" | "REJECTED") {
    if (!applicant) return;
    updateStatus.mutate({ id: applicant.id, status });
  }

  return (
    <SkilioMotionRoot className="mx-auto flex max-w-7xl flex-col gap-6">
      <Link
        href={`/jobs/${params.id}`}
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-[#466255] hover:text-[#2f7d4f]"
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
          <SkilioHero
            title={applicant.name}
            description={`Review ${applicant.job_postings?.title ?? "this role"} application, submitted ${formatDate(applicant.submittedAt)}.`}
            aside={
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#66765f]">Match</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-[#14213d]">
                    {applicant.matchScore === null ? "-" : `${applicant.matchScore}%`}
                  </div>
                </div>
                <div className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#66765f]">Status</div>
                  <Badge variant="outline" className="mt-2 rounded-md capitalize">
                    {formatStatus(applicant.status)}
                  </Badge>
                </div>
              </div>
            }
          />

          <SkilioPanel className="p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h2 className="font-semibold text-[#14213d]">Hiring decision</h2>
                <p className="text-sm text-[#5f6b7a]">Move the applicant after reviewing their full dossier below.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <DecisionButton
                  active={applicant.status === "REVIEWED"}
                  disabled={updateStatus.isLoading}
                  onClick={() => setStatus("REVIEWED")}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Mark reviewed
                </DecisionButton>
                <DecisionButton
                  active={applicant.status === "SHORTLISTED"}
                  disabled={updateStatus.isLoading}
                  onClick={() => setStatus("SHORTLISTED")}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Accept
                </DecisionButton>
                <DecisionButton
                  active={applicant.status === "REJECTED"}
                  disabled={updateStatus.isLoading}
                  className="border-[#e6b2ad] text-[#8a2d25]"
                  onClick={() => setStatus("REJECTED")}
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </DecisionButton>
              </div>
            </div>
          </SkilioPanel>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <SkilioPanel className="p-4">
                <div className="mb-4 flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-[#2f7d4f]" />
                  <h2 className="font-semibold text-[#14213d]">Candidate profile</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailLine icon={Mail} label="Email" value={applicant.email} />
                  <DetailLine icon={Phone} label="Phone" value={applicant.phone} />
                  <DetailLine icon={MapPin} label="Location" value={applicant.location} />
                  <DetailLine icon={Briefcase} label="Source" value={(applicant.source ?? "direct").toLowerCase()} />
                </div>
              </SkilioPanel>

              <SkilioPanel className="p-4">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#2f7d4f]" />
                  <h2 className="font-semibold text-[#14213d]">Application answers</h2>
                </div>
                <div className="grid gap-3">
                  <TextBlock label="Bio" value={applicant.bio} />
                  <TextBlock label="Cover letter" value={applicant.coverLetter} />
                  <TextBlock label="Work sample prompt" value={asString(profileSnapshot.workSamplePrompt)} />
                </div>
              </SkilioPanel>

              <SkilioPanel className="p-4">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#2f7d4f]" />
                  <h2 className="font-semibold text-[#14213d]">Skills and evidence</h2>
                </div>
                {skills.length === 0 ? (
                  <p className="text-sm text-[#5f6b7a]">No skills were submitted.</p>
                ) : (
                  <div className="grid gap-3">
                    {skills.map((skill) => {
                      const portfolioItem = portfolioEvidence.find(
                        (item) => firstText(item.name).toLowerCase() === skill.toLowerCase(),
                      );
                      const proofs = asRecordArray(portfolioItem?.proofs);
                      const videos = asRecordArray(portfolioItem?.videos);
                      return (
                        <div
                          key={skill}
                          className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold text-[#14213d]">{skill}</div>
                            <Badge variant="outline" className="rounded-md">
                              confidence {String(skillConfidence[skill] ?? "-")}
                            </Badge>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4b596d]">
                            {asString(skillEvidence[skill]) || "No written evidence provided."}
                          </p>
                          {(proofs.length > 0 || videos.length > 0) && (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              {proofs.length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66765f]">Portfolio proofs</div>
                                  <ul className="mt-2 list-disc space-y-1 pl-4">
                                    {proofs.map((proof, index) => <EvidenceLink key={index} item={proof} />)}
                                  </ul>
                                </div>
                              )}
                              {videos.length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66765f]">Portfolio videos</div>
                                  <ul className="mt-2 list-disc space-y-1 pl-4">
                                    {videos.map((video, index) => <EvidenceLink key={index} item={video} />)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </SkilioPanel>
            </div>

            <aside className="space-y-4">
              <SkilioPanel className="p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-[#2f7d4f]" />
                  <h2 className="font-semibold text-[#14213d]">CV and profile links</h2>
                </div>
                <div className="grid gap-2">
                  <ExternalLinkRow label="Skilio portfolio" value={asString(links.portfolio)} />
                  <ExternalLinkRow label="LinkedIn" value={asString(links.linkedin)} />
                  <ExternalLinkRow label="GitHub" value={asString(links.github)} />
                  <ExternalLinkRow label="Website" value={asString(links.website)} />
                  <ExternalLinkRow label={resumeName || "Resume"} value={resumeUrl} />
                  {!asString(links.portfolio) && !asString(links.linkedin) && !asString(links.github) && !asString(links.website) && !resumeUrl && (
                    <p className="text-sm text-[#5f6b7a]">No links were attached.</p>
                  )}
                </div>
              </SkilioPanel>

              <SkilioPanel className="p-4">
                <h2 className="font-semibold text-[#14213d]">Attachments</h2>
                <div className="mt-4 space-y-2">
                  {resumeName && (
                    <div className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-3 text-sm font-medium text-[#14213d]">
                      {resumeName}
                    </div>
                  )}
                  {certificateFileNames.map((fileName) => (
                    <div key={fileName} className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-3 text-sm font-medium text-[#14213d]">
                      {fileName}
                    </div>
                  ))}
                  {files.map((file) => (
                    <div key={file.id} className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-3">
                      <div className="text-sm font-medium text-[#14213d]">{file.fileName}</div>
                      <div className="mt-1 text-xs text-[#5f6b7a]">{file.kind}</div>
                    </div>
                  ))}
                  {!resumeName && certificateFileNames.length === 0 && files.length === 0 && (
                    <p className="text-sm text-[#5f6b7a]">No file names were attached.</p>
                  )}
                </div>
              </SkilioPanel>

              <SkilioPanel className="p-4">
                <h2 className="font-semibold text-[#14213d]">Submitted data</h2>
                <details className="mt-4 rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-3">
                  <summary className="cursor-pointer text-sm font-medium text-[#14213d]">Full profile snapshot</summary>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-[#4b596d]">
                    {JSON.stringify(profileSnapshot, null, 2)}
                  </pre>
                </details>
              </SkilioPanel>
            </aside>
          </div>
        </>
      )}
    </SkilioMotionRoot>
  );
}
