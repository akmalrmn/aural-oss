"use client";

import Link from "next/link";
import { BriefcaseBusiness, Copy, ExternalLink, Plus, Search, Sparkles, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { SkilioHero, SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
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
    <SkilioPanel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.1em] text-[#66765f]">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-[#14213d]">{value}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e6f6df] text-[#2f7d4f] transition-transform duration-700 group-hover:scale-105">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </SkilioPanel>
  );
}

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
    <SkilioMotionRoot className="mx-auto flex max-w-7xl flex-col gap-6">
      <SkilioHero
        title="Manage hiring from role to applicant signal."
        description="Create openings, publish Skilio application links, and keep every candidate source visible without returning to the old assessment workflow."
        action={
          <Button asChild className="gap-2 rounded-xl bg-[#7bc957] text-[#0e2148] hover:bg-[#8fd86c]">
            <Link href="/jobs/new">
              <Plus className="h-4 w-4" />
              Create job
            </Link>
          </Button>
        }
        aside={
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              <Sparkles className="h-4 w-4 text-[#7bc957]" />
              Live hiring console
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Open", totals.active],
                ["Applicants", totals.applicants],
                ["Match", totals.averageMatch],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white/12 p-3">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-white/50">{label}</div>
                  <div className="mt-2 text-xl font-semibold text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        }
      />

      <div className="grid grid-flow-dense gap-3 md:grid-cols-3">
        <StatCard label="Active jobs" value={totals.active} icon={BriefcaseBusiness} />
        <StatCard label="Total applicants" value={totals.applicants} icon={UsersRound} />
        <StatCard label="Average match" value={totals.averageMatch} icon={Search} />
      </div>

      <SkilioPanel className="shadow-[0_28px_90px_rgba(14,33,72,0.09)]">
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
                  "h-9 rounded-xl border px-3 text-sm font-medium transition",
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
        ) : jobs.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6f6df] text-[#2f7d4f]">
              <BriefcaseBusiness className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#14213d]">No job postings yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#5f6b7a]">
              Start with a draft, add must-have skills, then publish the public application link.
            </p>
            <Button asChild className="mt-5 rounded-xl bg-[#2f7d4f] text-white hover:bg-[#256a42]">
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
      </SkilioPanel>
    </SkilioMotionRoot>
  );
}
