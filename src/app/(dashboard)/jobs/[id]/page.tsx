"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  StopCircle,
  UsersRound,
} from "lucide-react";
import { ApplicantStatusBadge } from "@/components/jobs/applicant-status-badge";
import {
  EmployerMetricStrip,
  EmployerPageHeader,
} from "@/components/jobs/employer-page";
import { JobEditDialog } from "@/components/jobs/job-edit-dialog";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
import { SourceAttributionPanel } from "@/components/jobs/source-attribution-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc/client";

type JobDetail = {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employmentType?: string | null;
  seniority?: string | null;
  description?: string | null;
  screeningQuestions?: {
    id: string;
    prompt: string;
    type: "TEXT" | "YES_NO" | "SELECT";
    required: boolean;
    options: string[];
  }[];
  status: string;
  publicApplicationUrl: string;
  job_skills: { id: string; name: string; kind: string; priority: string }[];
  job_applications: {
    id: string;
    name: string;
    email: string;
    status: string;
    source: string | null;
    applicationMethod?: string | null;
    sourceLinkId?: string | null;
    job_source_links?: {
      name: string;
      channel: string;
    } | null;
    matchScore: number | null;
    submittedAt?: string;
  }[];
  summary: {
    totalApplicants: number;
    shortlisted: number;
    averageMatch: number | null;
    applicationMethods: { method: string; count: number }[];
  };
  sourceLinks: {
    id: string;
    name: string;
    channel: string;
    trackingCode: string;
    archivedAt: string | null;
    publicApplicationUrl: string;
  }[];
  attribution: {
    totalVisits: number;
    totalStarted: number;
    totalAttributedApplications: number;
    sources: {
      sourceLinkId: string | null;
      name: string;
      channel: string;
      trackingCode: string | null;
      archivedAt: string | null;
      visits: number;
      started: number;
      submitted: number;
      accepted: number;
      conversionRate: number | null;
    }[];
  };
};

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const jobQuery = trpc.job.getById.useQuery({ id: params.id });
  const transition = trpc.job.transition.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.job.getById.invalidate({ id: params.id });
      await utils.job.list.invalidate();
      const message =
        variables.action === "publish"
          ? "Job published"
          : variables.action === "pause"
            ? "Applications paused"
            : variables.action === "close"
              ? "Job closed"
              : "Job status updated";
      toast({ title: message });
    },
    onError: (error) => {
      toast({
        title: "Job status was not updated",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const job = jobQuery.data as JobDetail | undefined;
  async function copyLink() {
    if (!job) return;
    await navigator.clipboard.writeText(job.publicApplicationUrl);
    toast({ title: "Direct application link copied" });
  }

  return (
    <SkilioMotionRoot className="mx-auto flex max-w-7xl flex-col gap-6">
      <Link
        href="/jobs"
        className="inline-flex min-h-10 w-fit items-center gap-2 text-sm font-medium text-[var(--skilio-ink-soft)] hover:text-[var(--skilio-brand)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Jobs
      </Link>

      {jobQuery.isLoading || !job ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <>
          <EmployerPageHeader
            title={job.title}
            description={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <JobStatusBadge status={job.status} />
                <span>
                  {[job.department, job.location, job.employmentType, job.seniority]
                    .filter(Boolean)
                    .join(" / ") || "Opening details"}
                </span>
              </span>
            }
            actions={
              <>
                <JobEditDialog job={job} />
                <Button
                  variant="outline"
                  onClick={copyLink}
                  className="border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
                >
                  <Copy className="h-4 w-4" />
                  Copy direct link
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
                >
                  <a href={job.publicApplicationUrl} target="_blank" rel="noreferrer">
                    View apply page
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </>
            }
          />

          <EmployerMetricStrip
            metrics={[
              {
                label: "Applicants",
                value: job.summary.totalApplicants,
                detail: "Submitted applications",
              },
              {
                label: "Accepted",
                value: job.summary.shortlisted,
                detail: "Moved forward",
              },
              {
                label: "Average match",
                value:
                  job.summary.averageMatch === null
                    ? "-"
                    : `${job.summary.averageMatch}%`,
                detail: "Portfolio evidence",
              },
              {
                label: "Must-have skills",
                value: job.job_skills.filter((skill) => skill.priority === "MUST")
                  .length,
                detail: "Required for this role",
              },
            ]}
          />

          <SkilioPanel>
            <div className="flex items-center justify-between gap-4 border-b border-[var(--skilio-border)] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <UsersRound className="h-5 w-5 text-[var(--skilio-brand)]" />
                  <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                    Applicants
                  </h2>
                </div>
                <p className="mt-1 text-sm text-[var(--skilio-ink-muted)]">
                  Review submitted evidence and make the hiring decision from each dossier.
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--skilio-ink-soft)]">
                {job.job_applications.length} total
              </span>
            </div>

            {job.job_applications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <UsersRound className="mx-auto h-6 w-6 text-[var(--skilio-ink-muted)]" />
                <h3 className="mt-4 font-semibold text-[var(--skilio-ink)]">
                  No applicants yet
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--skilio-ink-soft)]">
                  Share the public application page to start receiving candidate evidence.
                </p>
                <Button
                  variant="outline"
                  className="mt-5 border-[var(--skilio-border-strong)]"
                  onClick={copyLink}
                >
                  <Copy className="h-4 w-4" />
                  Copy application link
                </Button>
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[var(--skilio-panel)] hover:bg-[var(--skilio-panel)]">
                        <TableHead>Candidate</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Match</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Review</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {job.job_applications.map((applicant) => (
                        <TableRow
                          key={applicant.id}
                          className="hover:bg-[var(--skilio-panel)]"
                        >
                          <TableCell className="min-w-56">
                            <Link
                              href={`/jobs/${job.id}/applicants/${applicant.id}`}
                              className="font-medium text-[var(--skilio-ink)] hover:text-[var(--skilio-brand)]"
                            >
                              {applicant.name}
                            </Link>
                            <div className="mt-1 text-xs text-[var(--skilio-ink-muted)]">
                              {applicant.email}
                            </div>
                          </TableCell>
                          <TableCell className="capitalize text-[var(--skilio-ink-soft)]">
                            {applicant.job_source_links?.name ?? "Direct"}
                          </TableCell>
                          <TableCell className="font-medium tabular-nums text-[var(--skilio-ink)]">
                            {applicant.matchScore === null
                              ? "-"
                              : `${applicant.matchScore}%`}
                          </TableCell>
                          <TableCell>
                            <ApplicantStatusBadge status={applicant.status} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-[var(--skilio-ink-muted)]">
                            {applicant.submittedAt
                              ? new Date(applicant.submittedAt).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
                              >
                                <Link
                                  href={`/jobs/${job.id}/applicants/${applicant.id}`}
                                >
                                  Review
                                  <ArrowRight className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="divide-y divide-[var(--skilio-border)] md:hidden">
                  {job.job_applications.map((applicant) => (
                    <article key={applicant.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-[var(--skilio-ink)]">
                            {applicant.name}
                          </h3>
                          <p className="mt-1 truncate text-xs text-[var(--skilio-ink-muted)]">
                            {applicant.email}
                          </p>
                        </div>
                        <ApplicantStatusBadge
                          status={applicant.status}
                          className="shrink-0"
                        />
                      </div>
                      <dl className="mt-4 grid grid-cols-3 gap-3">
                        <div>
                          <dt className="text-xs text-[var(--skilio-ink-muted)]">
                            Match
                          </dt>
                          <dd className="mt-1 font-semibold tabular-nums text-[var(--skilio-ink)]">
                            {applicant.matchScore === null
                              ? "-"
                              : `${applicant.matchScore}%`}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[var(--skilio-ink-muted)]">
                            Source
                          </dt>
                          <dd className="mt-1 truncate text-sm capitalize text-[var(--skilio-ink)]">
                            {applicant.job_source_links?.name ?? "Direct"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[var(--skilio-ink-muted)]">
                            Submitted
                          </dt>
                          <dd className="mt-1 whitespace-nowrap text-sm text-[var(--skilio-ink)]">
                            {applicant.submittedAt
                              ? new Date(applicant.submittedAt).toLocaleDateString()
                              : "-"}
                          </dd>
                        </div>
                      </dl>
                      <Button
                        asChild
                        variant="outline"
                        className="mt-4 w-full border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
                      >
                        <Link href={`/jobs/${job.id}/applicants/${applicant.id}`}>
                          Review application
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </article>
                  ))}
                </div>
              </>
            )}
          </SkilioPanel>

          <SourceAttributionPanel
            jobId={job.id}
            directApplicationUrl={job.publicApplicationUrl}
            sourceLinks={job.sourceLinks}
            attribution={job.attribution}
          />

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <SkilioPanel>
              <div className="border-b border-[var(--skilio-border)] px-5 py-4">
                <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                  Role brief
                </h2>
              </div>
              <div className="px-5 py-5">
                <div className="max-w-4xl whitespace-pre-wrap break-words text-sm leading-7 text-[var(--skilio-ink-soft)]">
                  {job.description || "No job description has been added."}
                </div>
              </div>
              <div className="border-t border-[var(--skilio-border)] px-5 py-5">
                <h3 className="font-semibold text-[var(--skilio-ink)]">
                  Pre-screening questions
                </h3>
                {(job.screeningQuestions ?? []).length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--skilio-ink-soft)]">
                    No questions configured.
                  </p>
                ) : (
                  <ol className="mt-4 divide-y divide-[var(--skilio-border)]">
                    {(job.screeningQuestions ?? []).map((question, index) => (
                      <li
                        key={question.id}
                        className="grid grid-cols-[24px_minmax(0,1fr)] gap-3 py-3 text-sm text-[var(--skilio-ink-soft)] first:pt-0 last:pb-0"
                      >
                        <span className="font-semibold tabular-nums text-[var(--skilio-brand)]">
                          {index + 1}
                        </span>
                        <span className="break-words">{question.prompt}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </SkilioPanel>

            <SkilioPanel>
              <section className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                      Opening controls
                    </h2>
                    <p className="mt-1 text-sm text-[var(--skilio-ink-muted)]">
                      Control whether candidates can apply.
                    </p>
                  </div>
                  <JobStatusBadge status={job.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(job.status === "DRAFT" || job.status === "PAUSED") && (
                    <Button
                      onClick={() =>
                        transition.mutate({ id: job.id, action: "publish" })
                      }
                      disabled={transition.isLoading}
                      className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
                    >
                      <PlayCircle className="h-4 w-4" />
                      Publish
                    </Button>
                  )}
                  {job.status === "ACTIVE" && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        transition.mutate({ id: job.id, action: "pause" })
                      }
                      disabled={transition.isLoading}
                      className="border-[var(--skilio-border-strong)]"
                    >
                      <PauseCircle className="h-4 w-4" />
                      Pause applications
                    </Button>
                  )}
                  {(job.status === "ACTIVE" ||
                    job.status === "PAUSED" ||
                    job.status === "DRAFT") && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        transition.mutate({ id: job.id, action: "close" })
                      }
                      disabled={transition.isLoading}
                      className="border-[#e6b2ad] text-[var(--skilio-danger)] hover:bg-[var(--skilio-danger-soft)]"
                    >
                      <StopCircle className="h-4 w-4" />
                      Close job
                    </Button>
                  )}
                </div>
              </section>

              <section className="border-t border-[var(--skilio-border)] p-5">
                <h3 className="font-semibold text-[var(--skilio-ink)]">
                  Required skills
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.job_skills.length === 0 ? (
                    <p className="text-sm text-[var(--skilio-ink-soft)]">
                      No skills configured.
                    </p>
                  ) : (
                    job.job_skills.map((skill) => (
                      <Badge
                        key={skill.id}
                        variant="outline"
                        className={
                          skill.priority === "MUST"
                            ? "rounded-md border-[#b6dfaa] bg-[#e6f6df] text-[#24533b]"
                            : "rounded-md border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] text-[var(--skilio-ink-soft)]"
                        }
                      >
                        {skill.name}
                      </Badge>
                    ))
                  )}
                </div>
              </section>

            </SkilioPanel>
          </div>
        </>
      )}
    </SkilioMotionRoot>
  );
}
