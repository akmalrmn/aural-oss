export type JobStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED" | "ARCHIVED";
export type JobStatusAction = "publish" | "pause" | "close" | "archive" | "restoreDraft";
export type ApplicationStatus = "NEW" | "REVIEWED" | "SHORTLISTED" | "REJECTED";

export type ApplicationSummaryInput = {
  status: ApplicationStatus;
  matchScore: number | null;
  source: string | null;
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
  const scored = applications
    .map((application) => application.matchScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  const sourceCounts = new Map<string, number>();
  for (const application of applications) {
    const source = application.source?.trim() || "direct";
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }

  return {
    totalApplicants: applications.length,
    shortlisted: applications.filter((application) => application.status === "SHORTLISTED").length,
    averageMatch:
      scored.length === 0
        ? null
        : Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length),
    sources: Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source)),
  };
}

function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

export function computeApplicationMatch(input: {
  requiredSkills: string[];
  optionalSkills: string[];
  candidateSkills: string[];
}): number | null {
  const candidate = new Set(input.candidateSkills.map(normalizeSkill).filter(Boolean));
  const required = Array.from(
    new Set(input.requiredSkills.map(normalizeSkill).filter(Boolean)),
  );
  const requiredSet = new Set(required);
  const optional = Array.from(
    new Set(input.optionalSkills.map(normalizeSkill).filter(Boolean)),
  ).filter((skill) => !requiredSet.has(skill));
  const totalWeight = required.length * 40 + optional.length * 10;

  if (totalWeight === 0) return null;

  const matchedRequired = required.filter((skill) => candidate.has(skill)).length * 40;
  const matchedOptional = optional.filter((skill) => candidate.has(skill)).length * 10;
  return Math.round(((matchedRequired + matchedOptional) / totalWeight) * 100);
}
