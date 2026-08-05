export type JobStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED" | "ARCHIVED";
export type JobStatusAction = "publish" | "pause" | "close" | "archive" | "restoreDraft";
export type ApplicationStatus = "NEW" | "REVIEWED" | "SHORTLISTED" | "REJECTED";

export type ApplicationSummaryInput = {
  status: ApplicationStatus;
  matchScore: number | null;
  applicationMethod?: string | null;
  source?: string | null;
  sourceLinkId?: string | null;
};

export type JobSourceLinkInput = {
  id: string;
  name: string;
  channel: string;
  trackingCode: string;
  archivedAt?: string | null;
};

export type JobSourceVisitInput = {
  sourceLinkId: string;
  applicationStartedAt?: string | null;
};

export function createJobPublicSlug(title: string, suffix: string): string {
  const base =
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || "job";
  return `${base}-${suffix.trim().toLowerCase()}`;
}

export function getNextJobStatus(status: JobStatus, action: JobStatusAction): JobStatus {
  const transitions: Record<JobStatusAction, Partial<Record<JobStatus, JobStatus>>> = {
    publish: { DRAFT: "ACTIVE", PAUSED: "ACTIVE" },
    pause: { ACTIVE: "PAUSED" },
    close: { ACTIVE: "CLOSED", PAUSED: "CLOSED", DRAFT: "CLOSED" },
    archive: { DRAFT: "ARCHIVED", CLOSED: "ARCHIVED" },
    restoreDraft: { PAUSED: "DRAFT", CLOSED: "DRAFT" },
  };

  const next = transitions[action][status];
  if (!next) {
    throw new Error(`Cannot ${action} a ${status.toLowerCase()} job.`);
  }
  return next;
}

export function summarizeJobApplications(applications: ApplicationSummaryInput[]) {
  const methodCounts = new Map<string, number>();
  for (const application of applications) {
    const method =
      application.applicationMethod?.trim() ||
      application.source?.trim() ||
      "GUEST";
    methodCounts.set(method, (methodCounts.get(method) ?? 0) + 1);
  }

  return {
    totalApplicants: applications.length,
    shortlisted: applications.filter((application) => application.status === "SHORTLISTED").length,
    averageMatch: null,
    applicationMethods: Array.from(methodCounts.entries())
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count || a.method.localeCompare(b.method)),
  };
}

export function summarizeJobAttribution(
  links: JobSourceLinkInput[],
  visits: JobSourceVisitInput[],
  applications: ApplicationSummaryInput[],
) {
  const rows = links.map((link) => {
    const linkVisits = visits.filter(
      (visit) => visit.sourceLinkId === link.id,
    );
    const linkApplications = applications.filter(
      (application) => application.sourceLinkId === link.id,
    );
    const submitted = linkApplications.length;
    const visitCount = linkVisits.length;

    return {
      sourceLinkId: link.id,
      name: link.name,
      channel: link.channel,
      trackingCode: link.trackingCode,
      archivedAt: link.archivedAt ?? null,
      visits: visitCount,
      started: linkVisits.filter((visit) => visit.applicationStartedAt).length,
      submitted,
      accepted: linkApplications.filter(
        (application) => application.status === "SHORTLISTED",
      ).length,
      conversionRate:
        visitCount === 0 ? null : Math.round((submitted / visitCount) * 100),
    };
  });

  const directApplications = applications.filter(
    (application) => !application.sourceLinkId,
  );

  return {
    totalVisits: visits.length,
    totalStarted: visits.filter((visit) => visit.applicationStartedAt).length,
    totalAttributedApplications: applications.length - directApplications.length,
    sources: [
      ...rows,
      {
        sourceLinkId: null,
        name: "Direct",
        channel: "DIRECT",
        trackingCode: null,
        archivedAt: null,
        visits: 0,
        started: 0,
        submitted: directApplications.length,
        accepted: directApplications.filter(
          (application) => application.status === "SHORTLISTED",
        ).length,
        conversionRate: null,
      },
    ],
  };
}
