"use client";

import Link from "next/link";
import { ArrowRight, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import {
  EmployerMetricStrip,
  EmployerPageHeader,
} from "@/components/jobs/employer-page";
import { SkilioMotionRoot, SkilioPanel } from "@/components/jobs/skilio-motion";
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
import { cn } from "@/lib/utils";

const statuses = ["ALL", "NEW", "REVIEWED", "SHORTLISTED", "REJECTED"] as const;

const applicantStatusStyles: Record<string, string> = {
  NEW: "border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] text-[var(--skilio-ink-soft)]",
  REVIEWED: "border-[#c7d4e6] bg-[#f2f6fb] text-[#355275]",
  SHORTLISTED: "border-[#b6dfaa] bg-[#e6f6df] text-[#24533b]",
  REJECTED: "border-[#e6b2ad] bg-[#fff0ee] text-[#8a2d25]",
};

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

function ApplicantStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-1 text-[11px] font-semibold capitalize",
        applicantStatusStyles[status] ?? applicantStatusStyles.NEW,
      )}
    >
      {status.toLowerCase()}
    </Badge>
  );
}

function formatSource(source: string | null) {
  return (source ?? "direct").toLowerCase();
}

export default function ApplicantsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("ALL");
  const { data = [], isLoading } = trpc.job.applications.useQuery(
    {},
    { enabled: true },
  );

  const applicants = data as Applicant[];
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return applicants.filter((applicant) => {
      const matchesStatus = status === "ALL" || applicant.status === status;
      const matchesSearch =
        !needle ||
        [applicant.name, applicant.email, applicant.job_postings?.title]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(needle));
      return matchesStatus && matchesSearch;
    });
  }, [applicants, search, status]);

  const counts = useMemo(
    () => ({
      new: applicants.filter((applicant) => applicant.status === "NEW").length,
      reviewed: applicants.filter((applicant) => applicant.status === "REVIEWED").length,
      shortlisted: applicants.filter(
        (applicant) => applicant.status === "SHORTLISTED",
      ).length,
    }),
    [applicants],
  );

  const hasFilters = search.trim().length > 0 || status !== "ALL";

  function clearFilters() {
    setSearch("");
    setStatus("ALL");
  }

  return (
    <SkilioMotionRoot className="mx-auto flex max-w-7xl flex-col gap-6">
      <EmployerPageHeader
        title="Applicants"
        description="Review candidate evidence across every role, then move each application to a clear decision."
      />

      <EmployerMetricStrip
        metrics={[
          { label: "All applicants", value: applicants.length, detail: "Across all jobs" },
          { label: "New", value: counts.new, detail: "Awaiting first review" },
          { label: "Reviewed", value: counts.reviewed, detail: "Evidence opened" },
          { label: "Shortlisted", value: counts.shortlisted, detail: "Ready to progress" },
        ]}
      />

      <SkilioPanel>
        <div className="flex flex-col gap-4 border-b border-[var(--skilio-border)] p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--skilio-ink-muted)]" />
            <Input
              aria-label="Search applicants"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search applicant or job"
              className="border-[var(--skilio-border-strong)] bg-[var(--skilio-control)] pl-9 text-[var(--skilio-ink)] focus-visible:ring-[var(--skilio-brand)]"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              role="group"
              aria-label="Filter applicants by status"
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
            <div className="flex items-center gap-2 whitespace-nowrap text-sm text-[var(--skilio-ink-muted)]">
              <UsersRound className="h-4 w-4" />
              {filtered.length} shown
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <UsersRound className="mx-auto h-6 w-6 text-[var(--skilio-ink-muted)]" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--skilio-ink)]">
              {hasFilters ? "No applicants match this view" : "No applicants yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--skilio-ink-soft)]">
              {hasFilters
                ? "Change the search or status filter to see more applications."
                : "Submitted applications will appear here with their role, evidence match, and review status."}
            </p>
            {hasFilters && (
              <Button
                variant="outline"
                className="mt-5 border-[var(--skilio-border-strong)]"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[var(--skilio-panel)] hover:bg-[var(--skilio-panel)]">
                    <TableHead>Candidate</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((applicant) => (
                    <TableRow
                      key={applicant.id}
                      className="hover:bg-[var(--skilio-panel)]"
                    >
                      <TableCell className="min-w-52">
                        <div className="font-medium text-[var(--skilio-ink)]">
                          {applicant.name}
                        </div>
                        <div className="mt-1 text-xs text-[var(--skilio-ink-muted)]">
                          {applicant.email}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-48">
                        {applicant.job_postings ? (
                          <Link
                            href={`/jobs/${applicant.job_postings.id}`}
                            className="font-medium text-[var(--skilio-ink)] hover:text-[var(--skilio-brand)]"
                          >
                            {applicant.job_postings.title}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="capitalize text-[var(--skilio-ink-soft)]">
                        {formatSource(applicant.source)}
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
                        {new Date(applicant.submittedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          {applicant.job_postings ? (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
                            >
                              <Link
                                href={`/jobs/${applicant.job_postings.id}/applicants/${applicant.id}`}
                              >
                                Review
                                <ArrowRight className="h-4 w-4" />
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

            <div className="divide-y divide-[var(--skilio-border)] md:hidden">
              {filtered.map((applicant) => (
                <article key={applicant.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-[var(--skilio-ink)]">
                        {applicant.name}
                      </h2>
                      <p className="mt-1 truncate text-xs text-[var(--skilio-ink-muted)]">
                        {applicant.email}
                      </p>
                    </div>
                    <ApplicantStatusBadge status={applicant.status} />
                  </div>

                  <div className="mt-4">
                    <div className="text-xs text-[var(--skilio-ink-muted)]">Role</div>
                    {applicant.job_postings ? (
                      <Link
                        href={`/jobs/${applicant.job_postings.id}`}
                        className="mt-1 block truncate text-sm font-medium text-[var(--skilio-ink)]"
                      >
                        {applicant.job_postings.title}
                      </Link>
                    ) : (
                      <div className="mt-1 text-sm text-[var(--skilio-ink-soft)]">-</div>
                    )}
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-3">
                    <div>
                      <dt className="text-xs text-[var(--skilio-ink-muted)]">Match</dt>
                      <dd className="mt-1 font-semibold tabular-nums text-[var(--skilio-ink)]">
                        {applicant.matchScore === null
                          ? "-"
                          : `${applicant.matchScore}%`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--skilio-ink-muted)]">Source</dt>
                      <dd className="mt-1 truncate text-sm capitalize text-[var(--skilio-ink)]">
                        {formatSource(applicant.source)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--skilio-ink-muted)]">Submitted</dt>
                      <dd className="mt-1 whitespace-nowrap text-sm text-[var(--skilio-ink)]">
                        {new Date(applicant.submittedAt).toLocaleDateString()}
                      </dd>
                    </div>
                  </dl>

                  {applicant.job_postings && (
                    <Button
                      asChild
                      variant="outline"
                      className="mt-4 w-full border-[var(--skilio-border-strong)] bg-[var(--skilio-elevated)] text-[var(--skilio-ink)] hover:bg-[var(--skilio-control)]"
                    >
                      <Link
                        href={`/jobs/${applicant.job_postings.id}/applicants/${applicant.id}`}
                      >
                        Review application
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </SkilioPanel>
    </SkilioMotionRoot>
  );
}
