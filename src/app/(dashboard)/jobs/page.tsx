"use client";

import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Copy,
  ExternalLink,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  EmployerMetricStrip,
  EmployerPageHeader,
} from "@/components/jobs/employer-page";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
import { useProject } from "@/components/project-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const statuses = ["ALL", "ACTIVE", "DRAFT", "PAUSED", "CLOSED"] as const;

type JobListItem = {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employmentType?: string | null;
  status: string;
  updatedAt?: string;
  publicApplicationUrl: string;
  summary: {
    totalApplicants: number;
    shortlisted: number;
    averageMatch: number | null;
  };
  job_skills: { id: string; name: string; priority: string }[];
};

export default function JobPostingsPage() {
  const { isLoading: projectLoading } = useProject();
  const { toast } = useToast();
  const [status, setStatus] = useState<(typeof statuses)[number]>("ALL");
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = trpc.job.list.useQuery(
    {
      status: status === "ALL" ? undefined : status,
      search: search.trim() || undefined,
    },
    { enabled: true },
  );

  const jobs = data as JobListItem[];
  const totals = useMemo(() => {
    const active = jobs.filter((job) => job.status === "ACTIVE").length;
    const applicants = jobs.reduce(
      (sum, job) => sum + job.summary.totalApplicants,
      0,
    );
    return {
      active,
      applicants,
      averageMatch: "N/A",
    };
  }, [jobs]);

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    toast({ title: "Application link copied" });
  }

  function clearFilters() {
    setSearch("");
    setStatus("ALL");
  }

  const hasFilters = search.trim().length > 0 || status !== "ALL";

  return (
    <SkilioMotionRoot className="mx-auto flex max-w-7xl flex-col gap-6">
      <EmployerPageHeader
        title="Jobs"
        description="Create openings, publish application links, and monitor applicant evidence by role."
        actions={
          <Button
            asChild
            className="bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
          >
            <Link href="/jobs/new">
              <Plus className="h-4 w-4" />
              Create job
            </Link>
          </Button>
        }
      />

      <EmployerMetricStrip
        className="grid-cols-3 md:grid-cols-3"
        metrics={[
          { label: "Roles in view", value: jobs.length, detail: `${totals.active} active` },
          {
            label: "Applicants in view",
            value: totals.applicants,
            detail: "Submitted applications",
          },
          {
            label: "Average match",
            value: totals.averageMatch,
            detail: "Scoring unavailable",
          },
        ]}
      />

      <SkilioPanel>
        <div className="flex flex-col gap-4 border-b border-[var(--skilio-border)] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--skilio-ink-muted)]" />
            <Input
              aria-label="Search jobs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search jobs"
              className="border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] pl-9 text-[var(--skilio-ink)] focus-visible:ring-[var(--skilio-brand)]"
            />
          </div>
          <div
            role="group"
            aria-label="Filter jobs by status"
            className="grid grid-cols-3 gap-1 rounded-[var(--skilio-radius-sm)] bg-[var(--skilio-control)] p-1 sm:flex"
          >
            {statuses.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={status === item}
                onClick={() => setStatus(item)}
                className={cn(
                  "min-h-9 rounded-md px-3 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--skilio-brand)] focus-visible:ring-offset-2",
                  status === item
                    ? "bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] shadow-[var(--skilio-shadow-1)]"
                    : "text-[var(--skilio-ink-muted)] hover:text-[var(--skilio-ink)]",
                )}
              >
                {item === "ALL" ? "All" : item.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {projectLoading || isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <BriefcaseBusiness className="mx-auto h-6 w-6 text-[var(--skilio-ink-muted)]" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--skilio-ink)]">
              {hasFilters ? "No jobs match this view" : "No job postings yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--skilio-ink-soft)]">
              {hasFilters
                ? "Change the search or status filter to see more roles."
                : "Create a role, add the required skills, then publish its application link."}
            </p>
            {hasFilters ? (
              <Button
                variant="outline"
                className="mt-5 border-[var(--skilio-border-strong)]"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            ) : (
              <Button
                asChild
                className="mt-5 bg-[var(--skilio-brand)] text-white hover:bg-[var(--skilio-brand-strong)]"
              >
                <Link href="/jobs/new">Create your first job</Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[var(--skilio-panel)] hover:bg-[var(--skilio-panel)]">
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applicants</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Required skills</TableHead>
                    <TableHead className="text-right">Application link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id} className="hover:bg-[var(--skilio-panel)]">
                      <TableCell className="min-w-64">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="font-semibold text-[var(--skilio-ink)] hover:text-[var(--skilio-brand)]"
                        >
                          {job.title}
                        </Link>
                        <div className="mt-1 text-xs text-[var(--skilio-ink-muted)]">
                          {[job.department, job.location, job.employmentType]
                            .filter(Boolean)
                            .join(" / ")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <JobStatusBadge status={job.status} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium tabular-nums text-[var(--skilio-ink)]">
                          {job.summary.totalApplicants}
                        </div>
                        <div className="mt-1 text-xs tabular-nums text-[var(--skilio-ink-muted)]">
                          {job.summary.shortlisted} shortlisted
                        </div>
                      </TableCell>
                      <TableCell className="font-medium tabular-nums text-[var(--skilio-ink)]">
                        N/A
                      </TableCell>
                      <TableCell className="max-w-72">
                        <div className="flex flex-wrap gap-1.5">
                          {job.job_skills.slice(0, 3).map((skill) => (
                            <Badge
                              key={skill.id}
                              variant="secondary"
                              className="rounded-md bg-[var(--skilio-control)] text-[var(--skilio-ink-soft)]"
                            >
                              {skill.name}
                            </Badge>
                          ))}
                          {job.job_skills.length > 3 && (
                            <Badge
                              variant="outline"
                              className="rounded-md border-[var(--skilio-border-strong)] text-[var(--skilio-ink-muted)]"
                            >
                              +{job.job_skills.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-[var(--skilio-border)] md:hidden">
              {jobs.map((job) => (
                <article key={job.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="block truncate font-semibold text-[var(--skilio-ink)]"
                      >
                        {job.title}
                      </Link>
                      <p className="mt-1 truncate text-xs text-[var(--skilio-ink-muted)]">
                        {[job.department, job.location, job.employmentType]
                          .filter(Boolean)
                          .join(" / ")}
                      </p>
                    </div>
                    <JobStatusBadge status={job.status} className="shrink-0" />
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-3">
                    <div>
                      <dt className="text-xs text-[var(--skilio-ink-muted)]">Applicants</dt>
                      <dd className="mt-1 font-semibold tabular-nums text-[var(--skilio-ink)]">
                        {job.summary.totalApplicants}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--skilio-ink-muted)]">Shortlisted</dt>
                      <dd className="mt-1 font-semibold tabular-nums text-[var(--skilio-ink)]">
                        {job.summary.shortlisted}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--skilio-ink-muted)]">Match</dt>
                      <dd className="mt-1 font-semibold tabular-nums text-[var(--skilio-ink)]">
                        N/A
                      </dd>
                    </div>
                  </dl>

                  {job.job_skills.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {job.job_skills.slice(0, 2).map((skill) => (
                        <Badge
                          key={skill.id}
                          variant="secondary"
                          className="rounded-md bg-[var(--skilio-control)] text-[var(--skilio-ink-soft)]"
                        >
                          {skill.name}
                        </Badge>
                      ))}
                      {job.job_skills.length > 2 && (
                        <Badge
                          variant="outline"
                          className="rounded-md border-[var(--skilio-border-strong)] text-[var(--skilio-ink-muted)]"
                        >
                          +{job.job_skills.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-[var(--skilio-border)] pt-3">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="px-0 text-[var(--skilio-brand)] hover:bg-transparent"
                    >
                      <Link href={`/jobs/${job.id}`}>
                        Manage role
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <div className="flex gap-1">
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
                </article>
              ))}
            </div>
          </>
        )}
      </SkilioPanel>
    </SkilioMotionRoot>
  );
}
