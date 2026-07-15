"use client";

import Link from "next/link";
import { Eye, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { SkilioHero, SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
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
import { trpc } from "@/lib/trpc/client";

type Applicant = {
  id: string;
  name: string;
  email: string;
  status: string;
  source: string | null;
  matchScore: number | null;
  submittedAt: string;
  job_postings?: {
    id: string;
    title: string;
    status: string;
  };
};

export default function ApplicantsPage() {
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = trpc.job.applications.useQuery(
    {},
    { enabled: true },
  );

  const applicants = data as Applicant[];
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return applicants;
    return applicants.filter((applicant) =>
      [applicant.name, applicant.email, applicant.job_postings?.title]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle)),
    );
  }, [applicants, search]);

  const shortlisted = applicants.filter((applicant) => applicant.status === "SHORTLISTED").length;

  return (
    <SkilioMotionRoot className="mx-auto flex max-w-7xl flex-col gap-6">
      <SkilioHero
        title="Applicant review without losing the hiring context."
        description="Scan candidates across active openings, compare match signals, and jump back to the exact job dashboard when the team needs detail."
        aside={
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--skilio-ink-muted)]">Total</div>
              <div className="mt-1 font-heading text-2xl font-semibold tabular-nums text-[var(--skilio-ink)]">{applicants.length}</div>
            </div>
            <div className="rounded-[var(--skilio-radius-md)] border border-[var(--skilio-border)] bg-[var(--skilio-control)] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--skilio-ink-muted)]">Shortlist</div>
              <div className="mt-1 font-heading text-2xl font-semibold tabular-nums text-[var(--skilio-ink)]">{shortlisted}</div>
            </div>
          </div>
        }
      />

      <SkilioPanel className="shadow-[0_28px_90px_rgba(14,33,72,0.09)]">
        <div className="flex flex-col gap-3 border-b border-[#edf2ea] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8874]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search applicant or job"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-[#5f6b7a]">
            <UsersRound className="h-4 w-4 text-[#2f7d4f]" />
            All accessible jobs
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#5f6b7a]">
            No applicants match this view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f7faf5]">
                  <TableHead>Candidate</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((applicant) => (
                  <TableRow key={applicant.id}>
                    <TableCell>
                      <div className="font-medium text-[#14213d]">{applicant.name}</div>
                      <div className="text-xs text-[#6a7686]">{applicant.email}</div>
                    </TableCell>
                    <TableCell>
                      {applicant.job_postings ? (
                        <Link
                          href={`/jobs/${applicant.job_postings.id}`}
                          className="font-medium text-[#24533b] hover:underline"
                        >
                          {applicant.job_postings.title}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="capitalize">
                      {(applicant.source ?? "direct").toLowerCase()}
                    </TableCell>
                    <TableCell>
                      {applicant.matchScore === null ? "-" : `${applicant.matchScore}%`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-md">
                        {applicant.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[#5f6b7a]">
                      {new Date(applicant.submittedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {applicant.job_postings ? (
                          <Button asChild variant="outline" size="sm" className="h-8 gap-2">
                            <Link href={`/jobs/${applicant.job_postings.id}/applicants/${applicant.id}`}>
                              <Eye className="h-4 w-4" />
                              Review
                            </Link>
                          </Button>
                        ) : (
                          "-"
                        )}
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
