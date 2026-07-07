"use client";

import Link from "next/link";
import { Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useProject } from "@/components/project-provider";
import { Badge } from "@/components/ui/badge";
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
  const { currentProject, isLoading: projectLoading } = useProject();
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = trpc.job.applications.useQuery(
    { projectId: currentProject?.id },
    { enabled: !!currentProject },
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
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-medium text-[#2f7d4f]">Pipeline</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-[#14213d]">
            Applicants
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f6b7a]">
            Review candidates across all open jobs in the selected project.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-72">
          <div className="rounded-lg border border-[#dfe8db] bg-white p-3 shadow-sm">
            <div className="text-xs text-[#66765f]">Total</div>
            <div className="mt-1 text-xl font-semibold text-[#14213d]">{applicants.length}</div>
          </div>
          <div className="rounded-lg border border-[#dfe8db] bg-white p-3 shadow-sm">
            <div className="text-xs text-[#66765f]">Shortlist</div>
            <div className="mt-1 text-xl font-semibold text-[#14213d]">{shortlisted}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#dfe8db] bg-white shadow-sm">
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
            {currentProject?.name ?? "No project selected"}
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
            Select a project to view applicants.
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
