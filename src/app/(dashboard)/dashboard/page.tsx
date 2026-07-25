"use client";

import Link from "next/link";
import { ArrowRight, Copy, ExternalLink, Plus } from "lucide-react";
import { useMemo } from "react";
import {
  EmployerMetricStrip,
  EmployerPageHeader,
} from "@/components/jobs/employer-page";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
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
    const shortlisted = applications.filter(
      (application) => application.status === "SHORTLISTED",
    ).length;
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
      <EmployerPageHeader
        title="Hiring overview"
        description="See what needs attention across open roles, applicant reviews, and public application links."
        actions={
          <>
            <Button
              asChild
              className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
            >
              <Link href="/jobs/new">
                <Plus className="h-4 w-4" />
                Create job
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
            >
              <Link href="/applicants">
                Review applicants
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <EmployerMetricStrip
        metrics={[
          { label: "Active jobs", value: summary.activeJobs, detail: "Accepting applications" },
          { label: "Applicants", value: summary.applicants, detail: "Across all roles" },
          { label: "Shortlisted", value: summary.shortlisted, detail: "Ready for a decision" },
          { label: "Average match", value: summary.averageMatch, detail: "Portfolio evidence" },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
        <SkilioPanel>
          <div className="flex items-center justify-between gap-4 border-b border-[var(--skilio-border)] px-5 py-4">
            <div>
              <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                Open roles
              </h2>
              <p className="mt-1 text-sm text-[var(--skilio-ink-muted)]">
                Application volume and evidence quality by role.
              </p>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="shrink-0 text-[var(--skilio-brand)] hover:bg-[var(--skilio-control)]"
            >
              <Link href="/jobs">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {jobsQuery.isLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-8">
              <h3 className="text-lg font-semibold text-[var(--skilio-ink)]">
                No job openings yet
              </h3>
              <p className="mt-2 max-w-lg text-sm text-[var(--skilio-ink-soft)]">
                Create a job to publish a candidate-facing application link and start
                collecting portfolio-backed applications.
              </p>
              <Button
                asChild
                className="mt-5 bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
              >
                <Link href="/jobs/new">Create job</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--skilio-border)]">
              {jobs.slice(0, 4).map((job) => (
                <div
                  key={job.id}
                  className="grid gap-4 p-5 transition-colors hover:bg-[var(--skilio-panel)] md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-semibold text-[var(--skilio-ink)] hover:text-[var(--skilio-brand)]"
                      >
                        {job.title}
                      </Link>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <div className="mt-1 truncate text-sm text-[var(--skilio-ink-muted)]">
                      {[job.department, job.location, job.employmentType]
                        .filter(Boolean)
                        .join(" / ")}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {job.job_skills.slice(0, 4).map((skill) => (
                        <Badge
                          key={skill.id}
                          variant="secondary"
                          className="rounded-md bg-[var(--skilio-control)] text-[var(--skilio-ink-soft)]"
                        >
                          {skill.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 md:justify-end">
                    <div className="mr-3 min-w-24 md:text-right">
                      <div className="text-sm font-semibold tabular-nums text-[var(--skilio-ink)]">
                        {job.summary.totalApplicants} applicants
                      </div>
                      <div className="text-xs tabular-nums text-[var(--skilio-ink-muted)]">
                        {job.summary.averageMatch === null
                          ? "No match data"
                          : `${job.summary.averageMatch}% match`}
                      </div>
                    </div>
                    <Button
                      aria-label={`Copy application link for ${job.title}`}
                      variant="ghost"
                      size="icon"
                      onClick={() => copyLink(job.publicApplicationUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button asChild variant="ghost" size="icon">
                      <a
                        aria-label={`Open application page for ${job.title}`}
                        href={job.publicApplicationUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SkilioPanel>

        <div className="grid content-start gap-4">
          <SkilioPanel>
            <div className="border-b border-[var(--skilio-border)] px-5 py-4">
              <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                Review queue
              </h2>
              <p className="mt-1 text-sm text-[var(--skilio-ink-muted)]">
                Candidates with the strongest portfolio signal.
              </p>
            </div>
            <div className="divide-y divide-[var(--skilio-border)]">
              {applicationsQuery.isLoading ? (
                <div className="space-y-3 p-5">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : topApplicants.length === 0 ? (
                <p className="p-5 text-sm text-[var(--skilio-ink-soft)]">
                  New applications will appear here for review.
                </p>
              ) : (
                topApplicants.map((applicant) => (
                  <Link
                    key={applicant.id}
                    href={`/jobs/${applicant.jobId}/applicants/${applicant.id}`}
                    className="flex min-h-16 items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[var(--skilio-panel)]"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[var(--skilio-ink)]">
                        {applicant.name}
                      </div>
                      <div className="truncate text-xs text-[var(--skilio-ink-muted)]">
                        {applicant.jobTitle}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold tabular-nums text-[var(--skilio-brand)]">
                        {applicant.matchScore === null ? "-" : `${applicant.matchScore}%`}
                      </div>
                      <div className="text-xs text-[var(--skilio-ink-muted)]">
                        {formatSource(applicant.source)}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </SkilioPanel>

          <SkilioPanel className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
                  Applicant sources
                </h2>
                <p className="mt-1 text-sm text-[var(--skilio-ink-muted)]">
                  Where submitted applications originated.
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums text-[var(--skilio-ink-soft)]">
                {summary.applicants} total
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {applicationsQuery.isLoading ? (
                <>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </>
              ) : summary.sources.length === 0 ? (
                <p className="text-sm text-[var(--skilio-ink-soft)]">
                  Sources appear after candidates apply.
                </p>
              ) : (
                summary.sources.map(([source, count]) => (
                  <div key={source}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-[var(--skilio-ink)]">{source}</span>
                      <span className="tabular-nums text-[var(--skilio-ink-muted)]">
                        {count}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--skilio-control-strong)]">
                      <div
                        className="h-full rounded-full bg-[var(--skilio-brand)]"
                        style={{
                          width: `${Math.max(
                            10,
                            (count / Math.max(summary.applicants, 1)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </SkilioPanel>
        </div>
      </div>

      {featuredJob && (
        <section
          data-skillio-reveal
          className="flex flex-col gap-4 border-t border-[var(--skilio-border)] pt-6 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <h2 className="font-heading text-lg font-semibold text-[var(--skilio-ink)]">
              Share your latest opening
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--skilio-ink-soft)]">
              Send candidates directly to the application page for {featuredJob.title}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
              onClick={() => copyLink(featuredJob.publicApplicationUrl)}
            >
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
            <Button
              asChild
              className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
            >
              <a href={featuredJob.publicApplicationUrl} target="_blank" rel="noreferrer">
                Open apply page
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>
      )}
    </SkilioMotionRoot>
  );
}
