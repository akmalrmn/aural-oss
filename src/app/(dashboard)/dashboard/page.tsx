"use client";

import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Copy,
  ExternalLink,
  Plus,
  RadioTower,
  UsersRound,
} from "lucide-react";
import { useMemo } from "react";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { SkilioHero, SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc/client";

type JobListItem = {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employmentType?: string | null;
  status: string;
  publicApplicationUrl: string;
  summary: {
    totalApplicants: number;
    shortlisted: number;
    averageMatch: number | null;
  };
  job_skills: { id: string; name: string; priority: string }[];
};

type ApplicationItem = {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  jobId: string;
  source: string | null;
  status: string;
  matchScore: number | null;
  submittedAt?: string;
};

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <SkilioPanel className="group p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5c7057]">
            {label}
          </div>
          <div className="mt-3 text-3xl font-semibold text-[#10233f]">{value}</div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e4f6dc] text-[#2f7d4f] transition-transform duration-500 group-hover:-translate-y-1">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </SkilioPanel>
  );
}

function formatSource(source: string | null) {
  if (!source) return "Direct";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export default function HiringOverviewPage() {
  const { toast } = useToast();
  const jobsQuery = trpc.job.list.useQuery({}, { enabled: true });
  const applicationsQuery = trpc.job.applications.useQuery({}, { enabled: true });

  const jobs = useMemo(
    () => (jobsQuery.data ?? []) as JobListItem[],
    [jobsQuery.data],
  );
  const applications = useMemo(
    () => (applicationsQuery.data ?? []) as ApplicationItem[],
    [applicationsQuery.data],
  );

  const summary = useMemo(() => {
    const activeJobs = jobs.filter((job) => job.status === "ACTIVE").length;
    const applicants = jobs.reduce((sum, job) => sum + job.summary.totalApplicants, 0);
    const avgScores = jobs
      .map((job) => job.summary.averageMatch)
      .filter((score): score is number => typeof score === "number");
    const shortlisted = applications.filter((application) => application.status === "SHORTLISTED").length;
    const sources = applications.reduce<Record<string, number>>((acc, application) => {
      const source = formatSource(application.source);
      acc[source] = (acc[source] ?? 0) + 1;
      return acc;
    }, {});

    return {
      activeJobs,
      applicants,
      shortlisted,
      averageMatch:
        avgScores.length === 0
          ? "-"
          : `${Math.round(avgScores.reduce((sum, score) => sum + score, 0) / avgScores.length)}%`,
      sources: Object.entries(sources).sort((a, b) => b[1] - a[1]),
    };
  }, [applications, jobs]);

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    toast({ title: "Application link copied" });
  }

  const featuredJob = jobs[0];
  const topApplicants = [...applications]
    .sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1))
    .slice(0, 4);

  return (
    <SkilioMotionRoot className="mx-auto flex max-w-7xl flex-col gap-6">
      <SkilioHero
        title="Your hiring room starts with open roles."
        description="Track live openings, applicant signals, and public application links from one Skilio workspace without returning to legacy hiring tools."
        action={
          <div className="flex flex-wrap gap-3">
            <Button asChild className="h-9 gap-2 rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">
              <Link href="/jobs/new">
                <Plus className="h-4 w-4" />
                Create job
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-9 gap-2 rounded-[var(--skilio-radius-md)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]">
              <Link href="/applicants">
                Review applicants
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
        aside={
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--skilio-ink-soft)]">
              <RadioTower className="h-4 w-4 text-[var(--skilio-brand)]" />
              Workspace signal
            </div>
            <div className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--skilio-ink-muted)]">Average match</div>
              <div className="mt-1 font-heading text-3xl font-semibold tabular-nums text-[var(--skilio-ink)]">{summary.averageMatch}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--skilio-control-strong)]">
                <div className="h-full w-2/3 rounded-full bg-[var(--skilio-brand)]" />
              </div>
            </div>
          </div>
        }
      />

      <div className="grid grid-flow-dense gap-3 md:grid-cols-4">
        <Metric label="Active jobs" value={summary.activeJobs} icon={BriefcaseBusiness} />
        <Metric label="Applicants" value={summary.applicants} icon={UsersRound} />
        <Metric label="Shortlist" value={summary.shortlisted} icon={CheckCircle2} />
        <Metric label="Match quality" value={summary.averageMatch} icon={RadioTower} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <SkilioPanel className="overflow-hidden">
          <div className="border-b border-[#edf2ea] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5c7057]">
              Opening lane
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-[#10233f]">Roles ready for applicants</h2>
          </div>

          {jobsQuery.isLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-8">
              <h3 className="text-lg font-semibold text-[#10233f]">No job openings yet</h3>
              <p className="mt-2 max-w-lg text-sm text-[#5e6b7a]">
                Create a job to publish a candidate-facing application link and start collecting portfolio-backed applications.
              </p>
              <Button asChild className="mt-5 rounded-xl bg-[#2f7d4f] text-white hover:bg-[#256a42]">
                <Link href="/jobs/new">Create job</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-[#edf2ea]">
              {jobs.slice(0, 4).map((job) => (
                <div key={job.id} className="group grid gap-4 p-5 transition hover:bg-[#fbfdf8] md:grid-cols-[1fr_auto]">
                  <div className="relative border-l-2 border-[#7bc957] pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/jobs/${job.id}`} className="font-semibold text-[#10233f] hover:text-[#2f7d4f]">
                        {job.title}
                      </Link>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <div className="mt-1 text-sm text-[#5e6b7a]">
                      {[job.department, job.location, job.employmentType].filter(Boolean).join(" / ")}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {job.job_skills.slice(0, 4).map((skill) => (
                        <Badge key={skill.id} variant="secondary" className="rounded-md bg-[#eef6ec] text-[#24533b]">
                          {skill.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    <div className="mr-2 text-right">
                      <div className="text-sm font-semibold text-[#10233f]">{job.summary.totalApplicants} applicants</div>
                      <div className="text-xs text-[#687683]">{job.summary.averageMatch ?? "-"} match</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => copyLink(job.publicApplicationUrl)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button asChild variant="ghost" size="icon">
                      <a href={job.publicApplicationUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SkilioPanel>

        <div className="grid gap-4">
          <SkilioPanel className="p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5c7057]">
              Applicant sources
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-[#10233f]">Where candidates arrive</h2>
            <div className="mt-5 space-y-4">
              {applicationsQuery.isLoading ? (
                <>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </>
              ) : summary.sources.length === 0 ? (
                <p className="text-sm text-[#5e6b7a]">Sources appear after candidates apply.</p>
              ) : (
                summary.sources.map(([source, count]) => (
                  <div key={source}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-[#10233f]">{source}</span>
                      <span className="text-[#5e6b7a]">{count}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e7efe3]">
                      <div
                        className="h-full rounded-full bg-[#2f7d4f]"
                        style={{ width: `${Math.max(14, (count / Math.max(summary.applicants, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </SkilioPanel>

          <SkilioPanel className="p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5c7057]">
              Next reviews
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-[#10233f]">Highest signal applicants</h2>
            <div className="mt-5 space-y-3">
              {applicationsQuery.isLoading ? (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              ) : topApplicants.length === 0 ? (
                <p className="text-sm text-[#5e6b7a]">Applicants will appear here after submission.</p>
              ) : (
                topApplicants.map((applicant) => (
                  <Link
                    key={applicant.id}
                    href={`/jobs/${applicant.jobId}`}
                    className="flex items-center justify-between rounded-2xl border border-[#e3ecde] bg-[#fbfdf8] p-3 transition hover:border-[#b8dfa9]"
                  >
                    <div>
                      <div className="font-medium text-[#10233f]">{applicant.name}</div>
                      <div className="text-xs text-[#5e6b7a]">{applicant.jobTitle}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[#2f7d4f]">
                        {applicant.matchScore === null ? "-" : `${applicant.matchScore}%`}
                      </div>
                      <div className="text-xs text-[#5e6b7a]">{formatSource(applicant.source)}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </SkilioPanel>
        </div>
      </div>

      {featuredJob && (
        <SkilioPanel className="flex flex-col gap-4 bg-[var(--skilio-panel)] p-5 md:flex-row md:items-center md:justify-between">
          <div className="relative border-l border-[var(--skilio-signal)] pl-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--skilio-brand)]">
              Candidate link
            </div>
            <h2 className="mt-1 text-xl font-semibold text-[var(--skilio-ink)]">Share the public application page</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--skilio-ink-soft)]">
              Send candidates directly to the Skilio application flow for {featuredJob.title}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-[var(--skilio-radius-md)] border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]" onClick={() => copyLink(featuredJob.publicApplicationUrl)}>
              <Copy className="mr-2 h-4 w-4" />
              Copy link
            </Button>
            <Button asChild className="rounded-[var(--skilio-radius-md)] bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]">
              <a href={featuredJob.publicApplicationUrl} target="_blank" rel="noreferrer">
                Open apply page
              </a>
            </Button>
          </div>
        </SkilioPanel>
      )}
    </SkilioMotionRoot>
  );
}
