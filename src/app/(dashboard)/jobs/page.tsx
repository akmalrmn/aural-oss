"use client";

import Link from "next/link";
import { BriefcaseBusiness, Copy, ExternalLink, Plus, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
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

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border border-[#dfe8db] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.1em] text-[#66765f]">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-[#14213d]">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e6f6df] text-[#2f7d4f]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function JobPostingsPage() {
  const { currentProject, isLoading: projectLoading } = useProject();
  const { toast } = useToast();
  const [status, setStatus] = useState<(typeof statuses)[number]>("ALL");
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = trpc.job.list.useQuery(
    {
      projectId: currentProject?.id,
      status: status === "ALL" ? undefined : status,
      search: search.trim() || undefined,
    },
    { enabled: !!currentProject },
  );

  const jobs = data as JobListItem[];
  const totals = useMemo(() => {
    const active = jobs.filter((job) => job.status === "ACTIVE").length;
    const applicants = jobs.reduce((sum, job) => sum + job.summary.totalApplicants, 0);
    const avgScores = jobs
      .map((job) => job.summary.averageMatch)
      .filter((score): score is number => typeof score === "number");

    return {
      active,
      applicants,
      averageMatch:
        avgScores.length === 0
          ? "-"
          : `${Math.round(avgScores.reduce((sum, score) => sum + score, 0) / avgScores.length)}%`,
    };
  }, [jobs]);

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    toast({ title: "Application link copied" });
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-medium text-[#2f7d4f]">Job portal</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-[#14213d]">
            Job postings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f6b7a]">
            Create openings, publish application links, and review applicant signals in one place.
          </p>
        </div>
        <Button asChild className="gap-2 bg-[#2f7d4f] text-white hover:bg-[#256a42]">
          <Link href="/jobs/new">
            <Plus className="h-4 w-4" />
            Create job
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Active jobs" value={totals.active} icon={BriefcaseBusiness} />
        <StatCard label="Total applicants" value={totals.applicants} icon={UsersRound} />
        <StatCard label="Average match" value={totals.averageMatch} icon={Search} />
      </div>

      <div className="rounded-lg border border-[#dfe8db] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#edf2ea] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-lg flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8874]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search job title"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statuses.map((item) => (
              <button
                key={item}
                onClick={() => setStatus(item)}
                className={cn(
                  "h-9 rounded-lg border px-3 text-sm font-medium transition",
                  status === item
                    ? "border-[#2f7d4f] bg-[#e6f6df] text-[#24533b]"
                    : "border-[#dfe8db] bg-white text-[#5f6b7a] hover:border-[#b6dfaa]",
                )}
              >
                {item === "ALL" ? "All" : item.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {projectLoading || isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !currentProject ? (
          <div className="p-10 text-center text-sm text-[#5f6b7a]">
            Select or create a project before posting jobs.
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#e6f6df] text-[#2f7d4f]">
              <BriefcaseBusiness className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#14213d]">No job postings yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#5f6b7a]">
              Start with a draft, add must-have skills, then publish the public application link.
            </p>
            <Button asChild className="mt-5 bg-[#2f7d4f] text-white hover:bg-[#256a42]">
              <Link href="/jobs/new">Create your first job</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f7faf5]">
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applicants</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} className="hover:bg-[#fbfdf9]">
                    <TableCell className="min-w-64">
                      <Link href={`/jobs/${job.id}`} className="font-semibold text-[#14213d]">
                        {job.title}
                      </Link>
                      <div className="mt-1 text-xs text-[#6a7686]">
                        {[job.department, job.location, job.employmentType].filter(Boolean).join(" / ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="font-medium text-[#14213d]">
                      {job.summary.totalApplicants}
                      <span className="ml-2 text-xs text-[#6a7686]">
                        {job.summary.shortlisted} shortlisted
                      </span>
                    </TableCell>
                    <TableCell>
                      {job.summary.averageMatch === null ? "-" : `${job.summary.averageMatch}%`}
                    </TableCell>
                    <TableCell className="max-w-72">
                      <div className="flex flex-wrap gap-1.5">
                        {job.job_skills.slice(0, 3).map((skill) => (
                          <Badge key={skill.id} variant="secondary" className="rounded-md">
                            {skill.name}
                          </Badge>
                        ))}
                        {job.job_skills.length > 3 && (
                          <Badge variant="outline" className="rounded-md">
                            +{job.job_skills.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyLink(job.publicApplicationUrl)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button asChild variant="ghost" size="icon">
                          <a href={job.publicApplicationUrl} target="_blank" rel="noreferrer">
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
        )}
      </div>
    </div>
  );
}
