"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  ListChecks,
  PauseCircle,
  PlayCircle,
  StopCircle,
  UsersRound,
} from "lucide-react";
import { JobEditDialog } from "@/components/jobs/job-edit-dialog";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { SkilioHero, SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
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
import { cn } from "@/lib/utils";

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
    matchScore: number | null;
    submittedAt?: string;
  }[];
  summary: {
    totalApplicants: number;
    shortlisted: number;
    averageMatch: number | null;
    sources: { source: string; count: number }[];
  };
};

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <SkilioPanel className="p-4">
      <div className="text-xs font-medium uppercase tracking-[0.1em] text-[#66765f]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-[#14213d]">{value}</div>
    </SkilioPanel>
  );
}

function formatStatus(status: string) {
  return status === "SHORTLISTED" ? "accepted" : status.toLowerCase();
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const jobQuery = trpc.job.getById.useQuery({ id: params.id });
  const transition = trpc.job.transition.useMutation({
    onSuccess: async () => {
      await utils.job.getById.invalidate({ id: params.id });
      await utils.job.list.invalidate();
    },
  });

  const job = jobQuery.data as JobDetail | undefined;
  const maxSource = Math.max(...(job?.summary.sources.map((source) => source.count) ?? [1]));

  async function copyLink() {
    if (!job) return;
    await navigator.clipboard.writeText(job.publicApplicationUrl);
    toast({ title: "Application link copied" });
  }

  return (
    <SkilioMotionRoot className="mx-auto flex max-w-7xl flex-col gap-6">
      <Link
        href="/jobs"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-[#466255] hover:text-[#2f7d4f]"
      >
        <ArrowLeft className="h-4 w-4" />
        Job postings
      </Link>

      {jobQuery.isLoading || !job ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : (
        <>
          <SkilioHero
            title={job.title}
            description="Track applicants, manage the job post, and keep the public application link close to the hiring team."
            action={
              <div className="flex flex-wrap gap-2">
                <JobEditDialog job={job} />
                <Button variant="outline" onClick={copyLink} className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copy link
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <a href={job.publicApplicationUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    View apply page
                  </a>
                </Button>
              </div>
            }
            aside={
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <JobStatusBadge status={job.status} />
                </div>
                <div className="mt-4 text-sm leading-6 text-[var(--skilio-ink-soft)]">
                  {[job.department, job.location, job.employmentType, job.seniority]
                    .filter(Boolean)
                    .join(" / ") || "Opening details"}
                </div>
              </div>
            }
          />

          <div className="grid grid-flow-dense gap-3 md:grid-cols-4">
            <Metric label="Applicants" value={job.summary.totalApplicants} />
            <Metric label="Accepted" value={job.summary.shortlisted} />
            <Metric
              label="Avg. skills match"
              value={job.summary.averageMatch === null ? "-" : `${job.summary.averageMatch}%`}
            />
            <Metric label="Must-have skills" value={job.job_skills.filter((s) => s.priority === "MUST").length} />
          </div>

          <SkilioPanel className="p-5">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--skilio-brand)]" />
              <h2 className="font-semibold text-[var(--skilio-ink)]">
                Job description
              </h2>
            </div>
            <div className="mt-4 max-w-5xl whitespace-pre-wrap break-words text-sm leading-7 text-[var(--skilio-ink-soft)]">
              {job.description || "No job description has been added."}
            </div>
          </SkilioPanel>

          <div className="grid gap-4 lg:grid-cols-4">
            <SkilioPanel className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[#14213d]">Job post status</h2>
                  <p className="text-sm text-[#5f6b7a]">Control whether candidates can apply.</p>
                </div>
                <JobStatusBadge status={job.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(job.status === "DRAFT" || job.status === "PAUSED") && (
                  <Button
                    onClick={() => transition.mutate({ id: job.id, action: "publish" })}
                    disabled={transition.isLoading}
                    className="gap-2 bg-[#2f7d4f] text-white hover:bg-[#256a42]"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Publish
                  </Button>
                )}
                {job.status === "ACTIVE" && (
                  <Button
                    variant="outline"
                    onClick={() => transition.mutate({ id: job.id, action: "pause" })}
                    disabled={transition.isLoading}
                    className="gap-2"
                  >
                    <PauseCircle className="h-4 w-4" />
                    Pause applications
                  </Button>
                )}
                {(job.status === "ACTIVE" || job.status === "PAUSED" || job.status === "DRAFT") && (
                  <Button
                    variant="outline"
                    onClick={() => transition.mutate({ id: job.id, action: "close" })}
                    disabled={transition.isLoading}
                    className="gap-2 border-[#e6b2ad] text-[#8a2d25]"
                  >
                    <StopCircle className="h-4 w-4" />
                    Close job
                  </Button>
                )}
              </div>
            </SkilioPanel>

            <SkilioPanel className="p-4">
              <h2 className="font-semibold text-[#14213d]">Application sources</h2>
              <div className="mt-4 space-y-3">
                {job.summary.sources.length === 0 ? (
                  <div className="text-sm text-[#5f6b7a]">No source data yet.</div>
                ) : (
                  job.summary.sources.map((source) => (
                    <div key={source.source}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="capitalize text-[#4b596d]">{source.source.toLowerCase()}</span>
                        <span className="font-medium text-[#14213d]">{source.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#edf2ea]">
                        <div
                          className="h-full rounded-full bg-[#7bc957]"
                          style={{ width: `${Math.max(8, (source.count / maxSource) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SkilioPanel>

            <SkilioPanel className="p-4">
              <h2 className="font-semibold text-[#14213d]">Skills</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {job.job_skills.map((skill) => (
                  <Badge
                    key={skill.id}
                    variant={skill.priority === "MUST" ? "default" : "outline"}
                    className={cn(
                      "rounded-md",
                      skill.priority === "MUST" && "bg-[#e6f6df] text-[#24533b] hover:bg-[#e6f6df]",
                    )}
                  >
                    {skill.name}
                  </Badge>
                ))}
              </div>
            </SkilioPanel>

            <SkilioPanel className="p-4">
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-[var(--skilio-brand)]" />
                <h2 className="font-semibold text-[var(--skilio-ink)]">
                  Pre-screening
                </h2>
              </div>
              <div className="mt-4">
                {(job.screeningQuestions ?? []).length === 0 ? (
                  <p className="text-sm text-[var(--skilio-ink-soft)]">
                    No questions configured.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {(job.screeningQuestions ?? []).map((question, index) => (
                      <li
                        key={question.id}
                        className="flex gap-3 text-sm text-[var(--skilio-ink-soft)]"
                      >
                        <span className="font-semibold tabular-nums text-[var(--skilio-brand)]">
                          {index + 1}.
                        </span>
                        <span className="break-words">{question.prompt}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </SkilioPanel>
          </div>

          <SkilioPanel className="shadow-[0_28px_90px_rgba(14,33,72,0.09)]">
            <div className="flex flex-col gap-3 border-b border-[#edf2ea] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <UsersRound className="h-5 w-5 text-[#2f7d4f]" />
                  <h2 className="font-semibold text-[#14213d]">Applicants</h2>
                </div>
                <p className="mt-1 text-sm text-[#5f6b7a]">
                  Open each dossier to inspect form answers, CV, skills, and portfolio evidence.
                </p>
              </div>
              <div className="text-sm font-medium tabular-nums text-[#5f6b7a]">
                {job.job_applications.length} total
              </div>
            </div>
            {job.job_applications.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#5f6b7a]">
                No applicants yet. Share the public application link to start receiving profiles.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f7faf5]">
                    <TableHead>Candidate</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Skills match</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {job.job_applications.map((applicant) => (
                    <TableRow key={applicant.id} className="hover:bg-[#fbfdf9]">
                      <TableCell>
                        <Link
                          href={`/jobs/${job.id}/applicants/${applicant.id}`}
                          className="font-medium text-[#14213d] hover:text-[#2f7d4f]"
                        >
                          {applicant.name}
                        </Link>
                        <div className="text-xs text-[#6a7686]">{applicant.email}</div>
                        <Link
                          href={`/jobs/${job.id}/applicants/${applicant.id}`}
                          className="mt-2 inline-flex text-xs font-semibold text-[#2f7d4f] hover:underline sm:hidden"
                        >
                          Review dossier
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize">
                        {(applicant.source ?? "direct").toLowerCase()}
                      </TableCell>
                      <TableCell className="font-medium tabular-nums text-[#14213d]">
                        {applicant.matchScore === null ? "-" : `${applicant.matchScore}%`}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-md capitalize">
                          {formatStatus(applicant.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-[#5f6b7a]">
                        {applicant.submittedAt ? new Date(applicant.submittedAt).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button asChild variant="outline" size="sm" className="h-8 gap-2">
                            <Link href={`/jobs/${job.id}/applicants/${applicant.id}`}>
                              <Eye className="h-4 w-4" />
                              Review
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SkilioPanel>
        </>
      )}
    </SkilioMotionRoot>
  );
}
