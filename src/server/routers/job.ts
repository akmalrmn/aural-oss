import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "@/lib/id";
import {
  createApplicationDrawingAssessment,
  DRAWING_STARTER_SHAPES,
  isDrawingAssessmentReusable,
  isValidDrawingPhrase,
  parseApplicationDrawingAssessment,
  type ApplicationDrawingAssessment,
} from "@/lib/drawing-assessment";
import type { Context } from "@/server/context";
import {
  createJobPublicSlug,
  getNextJobStatus,
  summarizeJobAttribution,
  summarizeJobApplications,
  type ApplicationStatus,
  type JobStatus,
  type JobStatusAction,
} from "@/lib/jobs/job-utils";
import { consumeJobAuthoringRateLimit } from "@/lib/jobs/job-authoring-rate-limit";
import {
  JOB_DESCRIPTION_MAX_LENGTH,
  JOB_DESCRIPTION_MIN_LENGTH,
} from "@/lib/jobs/job-description";
import { generateJobDraft } from "@/lib/jobs/job-draft-generator";
import { createApplicationFileUploadToken } from "@/lib/jobs/application-file-upload-token";
import { resolveStorageSignedUrl } from "@/lib/storage-signed-url";
import {
  extractPortfolioSkills,
  provisionPortfolioAccount,
  searchPortfolioSkills,
  type PortfolioProvisioningSkill,
} from "@/lib/skilio-service-client";
import {
  assertMinRole,
  getEffectiveProjectRole,
  getOrgMembership,
  hasProjectAccess,
  protectedProcedure,
  publicProcedure,
  router,
} from "../trpc";

const JOB_SELECT = `
  *,
  job_skills(*),
  job_applications(
    id,
    status,
    reviewTier,
    source,
    applicationMethod,
    sourceLinkId,
    matchScore,
    submittedAt,
    name,
    email,
    job_source_links(name,channel)
  )
`;

const DEFAULT_SOURCE_LINKS = [
  { name: "LinkedIn", channel: "LINKEDIN", presetKey: "LINKEDIN", prefix: "li" },
  { name: "JobStreet", channel: "JOBSTREET", presetKey: "JOBSTREET", prefix: "js" },
  { name: "Indeed", channel: "INDEED", presetKey: "INDEED", prefix: "in" },
] as const;

const skillSchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(["HARD", "SOFT"]).default("HARD"),
  priority: z.enum(["MUST", "NICE"]).default("MUST"),
  lightcastId: z.string().max(80).nullish(),
  lightcastType: z.string().max(80).nullish(),
  lightcastDescription: z.string().max(2000).nullish(),
  lightcastApiVersion: z.string().max(40).nullish(),
  lightcastCategoryId: z.string().max(80).nullish(),
  lightcastCategoryName: z.string().max(160).nullish(),
  lightcastSubcategoryId: z.string().max(80).nullish(),
  lightcastSubcategoryName: z.string().max(160).nullish(),
  skillSource: z.enum(["LIGHTCAST", "CUSTOM"]).default("CUSTOM"),
});

const applicationPortfolioSkillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  lightcastId: z.string().trim().max(80).nullish(),
  lightcastType: z
    .enum(["SPECIALIZED", "COMMON", "CERTIFICATION"])
    .nullish(),
  lightcastDescription: z.string().trim().max(2000).nullish(),
  lightcastApiVersion: z.string().trim().max(40).nullish(),
  categoryId: z.string().trim().max(80).nullish(),
  categoryName: z.string().trim().max(160).nullish(),
  subcategoryId: z.string().trim().max(80).nullish(),
  subcategoryName: z.string().trim().max(160).nullish(),
});

const screeningQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  prompt: z.string().min(3).max(300),
  type: z.enum(["TEXT", "YES_NO", "SELECT"]).default("TEXT"),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1).max(120)).max(12).default([]),
});

function normalizeOptionalUrl(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const optionalUrlSchema = z.preprocess(
  normalizeOptionalUrl,
  z.string().url().optional(),
);

const linksSchema = z
  .object({
    portfolio: optionalUrlSchema,
    linkedin: optionalUrlSchema,
    website: optionalUrlSchema,
    github: optionalUrlSchema,
    resume: optionalUrlSchema,
  })
  .partial()
  .default({});

const drawingResponseSchema = z.object({
  starterShape: z.enum([
    "CIRCLE",
    "DIAMOND",
    "CROSS",
    "SQUARE",
    "TEE",
    "TRIANGLE",
    "DOT",
    "HEXAGON",
    "SLOPE",
    "LINE",
  ]),
  phrase: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .refine(
      isValidDrawingPhrase,
      "Describe each drawing in three words or fewer.",
    ),
  imageDataUrl: z
    .string()
    .max(750_000)
    .refine(
      (value) => value.startsWith("data:image/png;base64,"),
      "Drawing screenshots must be PNG images.",
    ),
});

const drawingResponsesSchema = z
  .array(drawingResponseSchema)
  .length(DRAWING_STARTER_SHAPES.length)
  .superRefine((responses, ctx) => {
    DRAWING_STARTER_SHAPES.forEach((shape, index) => {
      if (responses[index]?.starterShape !== shape.value) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "starterShape"],
          message: `Drawing ${index + 1} must use the ${shape.label} starter.`,
        });
      }
    });
  });

type SupabaseLike = Context["supabase"];

type JobSkill = {
  id: string;
  jobId: string;
  name: string;
  kind: "HARD" | "SOFT";
  priority: "MUST" | "NICE";
  displayOrder: number;
  lightcastId?: string | null;
  lightcastType?: string | null;
  lightcastDescription?: string | null;
  lightcastApiVersion?: string | null;
  lightcastCategoryId?: string | null;
  lightcastCategoryName?: string | null;
  lightcastSubcategoryId?: string | null;
  lightcastSubcategoryName?: string | null;
  skillSource?: "LIGHTCAST" | "CUSTOM";
};

type JobApplicationListItem = {
  id: string;
  status: ApplicationStatus;
  reviewTier?:
    | "TIER_1"
    | "TIER_2"
    | "TIER_3"
    | "TIER_4"
    | "TIER_5"
    | null;
  source: string | null;
  applicationMethod?: "SKILIO" | "GUEST" | null;
  sourceLinkId?: string | null;
  job_source_links?: {
    name: string;
    channel: string;
  } | null;
  matchScore: number | null;
  submittedAt?: string;
  name?: string;
  email?: string;
};

type JobPostingRecord = {
  id: string;
  projectId: string;
  status: JobStatus;
  title: string;
  publicSlug: string;
  job_skills?: JobSkill[];
  job_applications?: JobApplicationListItem[];
  [key: string]: unknown;
};

type JobSourceLinkRecord = {
  id: string;
  jobId: string;
  name: string;
  channel: "LINKEDIN" | "JOBSTREET" | "INDEED" | "CUSTOM";
  presetKey: "LINKEDIN" | "JOBSTREET" | "INDEED" | null;
  trackingCode: string;
  archivedAt: string | null;
  createdAt: string;
};

type JobSourceVisitRecord = {
  id: string;
  jobId: string;
  sourceLinkId: string;
  visitorId: string;
  applicationStartedAt: string | null;
};

type PortfolioProvisioningView = {
  status: "CREATED" | "EXISTING_ACCOUNT" | "FAILED";
  nextUrl?: string | null;
  activationEmailSent?: boolean | null;
  skillsAdded?: number;
  skillsAlreadyPresent?: number;
  message?: string;
};

function portfolioSkillType(
  value?: string | null,
): PortfolioProvisioningSkill["lightcastType"] {
  if (value === "Specialized Skill" || value === "SPECIALIZED") {
    return "SPECIALIZED";
  }
  if (value === "Common Skill" || value === "COMMON") return "COMMON";
  if (value === "Certification" || value === "CERTIFICATION") {
    return "CERTIFICATION";
  }
  return null;
}

function provisioningSkills(
  selectedSkills: string[],
  jobSkills: JobSkill[],
  submittedDetails: PortfolioProvisioningSkill[] = [],
): PortfolioProvisioningSkill[] {
  return selectedSkills.map((name) => {
    const submitted = submittedDetails.find(
      (skill) => skill.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    const jobSkill = jobSkills.find(
      (skill) => skill.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (!jobSkill && !submitted) return { name };

    return {
      name,
      lightcastId: submitted?.lightcastId ?? jobSkill?.lightcastId,
      lightcastType:
        submitted?.lightcastType ?? portfolioSkillType(jobSkill?.lightcastType),
      lightcastDescription:
        submitted?.lightcastDescription ?? jobSkill?.lightcastDescription,
      lightcastApiVersion:
        submitted?.lightcastApiVersion ?? jobSkill?.lightcastApiVersion,
      categoryId: submitted?.categoryId ?? jobSkill?.lightcastCategoryId,
      categoryName: submitted?.categoryName ?? jobSkill?.lightcastCategoryName,
      subcategoryId:
        submitted?.subcategoryId ?? jobSkill?.lightcastSubcategoryId,
      subcategoryName:
        submitted?.subcategoryName ?? jobSkill?.lightcastSubcategoryName,
    };
  });
}

async function runPortfolioProvisioning(
  supabase: SupabaseLike,
  input: {
    applicationId: string;
    portfolioUserId?: string;
    name: string;
    email: string;
    country?: string | null;
    phone?: string | null;
    selectedSkills: string[];
    jobSkills: JobSkill[];
    skillDetails?: PortfolioProvisioningSkill[];
  },
): Promise<PortfolioProvisioningView> {
  const { data: current } = await supabase
    .from("job_application_provisioning")
    .select("id,attempts,status")
    .eq("applicationId", input.applicationId)
    .maybeSingle();
  const attempts = Math.min((current?.attempts ?? 0) + 1, 5);
  const pending = {
    status: "PENDING",
    attempts,
    lastAttemptAt: new Date().toISOString(),
    lastError: null,
  };

  if (current) {
    await supabase
      .from("job_application_provisioning")
      .update(pending)
      .eq("id", current.id);
  } else {
    const { error } = await supabase
      .from("job_application_provisioning")
      .insert({
        applicationId: input.applicationId,
        ...pending,
      });
    if (error) {
      return {
        status: "FAILED",
        message: "Your application was submitted, but Skilio account setup could not start.",
      };
    }
  }

  try {
    const result = await provisionPortfolioAccount({
      applicationId: input.applicationId,
      portfolioUserId: input.portfolioUserId,
      name: input.name,
      email: input.email,
      country: input.country,
      phone: input.phone,
      skills: provisioningSkills(
        input.selectedSkills,
        input.jobSkills,
        input.skillDetails,
      ),
    });
    const status =
      result.status === "CREATED" ? "COMPLETED" : "EXISTING_ACCOUNT";
    await supabase
      .from("job_application_provisioning")
      .update({
        status,
        portfolioUserId: result.portfolioUserId,
        username: result.username,
        nextUrl: result.nextUrl,
        activationEmailSent: result.activationEmailSent ?? null,
        completedAt: new Date().toISOString(),
        lastError: null,
      })
      .eq("applicationId", input.applicationId);

    return {
      status: result.status,
      nextUrl: result.nextUrl,
      activationEmailSent: result.activationEmailSent,
      skillsAdded: result.skillsAdded,
      skillsAlreadyPresent: result.skillsAlreadyPresent,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Skilio account setup failed.";
    await supabase
      .from("job_application_provisioning")
      .update({
        status: "FAILED",
        lastError: message,
      })
      .eq("applicationId", input.applicationId);
    return {
      status: "FAILED",
      message:
        "Your application was submitted, but Skilio account setup needs another attempt.",
    };
  }
}

function drawingAssessmentFromSnapshot(
  snapshot: unknown,
): ApplicationDrawingAssessment | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  return parseApplicationDrawingAssessment(
    (snapshot as Record<string, unknown>).drawingAssessment,
  );
}

async function findReusableDrawingAssessment(
  supabase: SupabaseLike,
  identity: {
    identityLinkId?: string;
    portfolioUserId?: string;
    email?: string;
  },
) {
  const lookups = [
    identity.identityLinkId
      ? { column: "identityLinkId", value: identity.identityLinkId, ilike: false }
      : null,
    identity.portfolioUserId
      ? { column: "portfolioUserId", value: identity.portfolioUserId, ilike: false }
      : null,
    identity.email
      ? { column: "email", value: identity.email.trim(), ilike: true }
      : null,
  ].filter(
    (
      lookup,
    ): lookup is { column: string; value: string; ilike: boolean } =>
      Boolean(lookup),
  );

  for (const lookup of lookups) {
    let query = supabase
      .from("job_applications")
      .select("profileSnapshot, submittedAt")
      .order("submittedAt", { ascending: false })
      .limit(20);
    query = lookup.ilike
      ? query.ilike(lookup.column, lookup.value)
      : query.eq(lookup.column, lookup.value);

    const { data } = await query;
    for (const application of data ?? []) {
      const assessment = drawingAssessmentFromSnapshot(
        application.profileSnapshot,
      );
      if (assessment && isDrawingAssessmentReusable(assessment)) {
        return assessment;
      }
    }
  }

  return null;
}

async function getProjectForAccess(
  supabase: SupabaseLike,
  projectId: string,
  userId: string,
  requiredRole: "VIEWER" | "MEMBER" | "ADMIN" = "VIEWER",
) {
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, organizationId")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const membership = await getOrgMembership(supabase, project.organizationId, userId);
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  const accessible = await hasProjectAccess(supabase, projectId, userId);
  if (!accessible) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  const role = await getEffectiveProjectRole(
    supabase,
    projectId,
    userId,
    membership.role,
  );
  assertMinRole(role, requiredRole);

  return { project, role };
}

async function getJobForAccess(
  supabase: SupabaseLike,
  jobId: string,
  userId: string,
  requiredRole: "VIEWER" | "MEMBER" | "ADMIN" = "VIEWER",
) {
  const { data: job, error } = await supabase
    .from("job_postings")
    .select("id, projectId, status, title, publicSlug")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  await getProjectForAccess(supabase, job.projectId, userId, requiredRole);
  return job as JobPostingRecord;
}

function shapeJob(job: JobPostingRecord) {
  const applications = (
    (job.job_applications ?? []) as JobApplicationListItem[]
  ).map((application) => ({ ...application, matchScore: null }));
  const skills = [...((job.job_skills ?? []) as JobSkill[])].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
  );

  return {
    ...job,
    job_skills: skills,
    job_applications: applications,
    summary: summarizeJobApplications(applications),
  };
}

function publicApplicationUrl(slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://assessment.skilio.co";
  return `${appUrl.replace(/\/$/, "")}/apply/${slug}`;
}

function sourceApplicationUrl(slug: string, trackingCode: string) {
  const url = new URL(publicApplicationUrl(slug));
  url.searchParams.set("src", trackingCode);
  return url.toString();
}

function defaultSourceLinkRows(jobId: string) {
  return DEFAULT_SOURCE_LINKS.map((source) => ({
    jobId,
    name: source.name,
    channel: source.channel,
    presetKey: source.presetKey,
    trackingCode: `${source.prefix}_${nanoid(12)}`,
  }));
}

export const jobRouter = router({
  generateDraft: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().trim().min(2).max(140),
        department: z.string().trim().max(100).optional(),
        location: z.string().trim().max(120).optional(),
        employmentType: z
          .enum(["Full-time", "Part-time", "Contract", "Internship"])
          .optional(),
        seniority: z
          .enum(["Entry-level", "Mid-level", "Senior", "Lead"])
          .optional(),
        notes: z.string().trim().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.JOB_AI_AUTHORING_ENABLED === "false") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "AI job authoring is currently unavailable.",
        });
      }

      await getProjectForAccess(
        ctx.supabase as SupabaseLike,
        input.projectId,
        ctx.user.id,
        "MEMBER",
      );

      const retryAfter = consumeJobAuthoringRateLimit(
        `job-draft:${ctx.user.id}`,
      );
      if (retryAfter) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many authoring requests. Retry in ${retryAfter}s.`,
        });
      }

      try {
        return await generateJobDraft({
          source: "brief",
          content: JSON.stringify(
            {
              roleTitle: input.title,
              department: input.department || undefined,
              location: input.location || undefined,
              employmentType: input.employmentType || undefined,
              seniority: input.seniority || undefined,
              employerNotes: input.notes || undefined,
            },
            null,
            2,
          ),
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "The role draft could not be generated.",
        });
      }
    }),

  searchSkills: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().min(2).max(80),
        limit: z.number().int().min(1).max(20).default(10),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await searchPortfolioSkills(input.query, input.limit);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "The skill catalogue is temporarily unavailable.",
        });
      }
    }),

  suggestSkills: protectedProcedure
    .input(
      z.object({
        description: z
          .string()
          .trim()
          .min(JOB_DESCRIPTION_MIN_LENGTH)
          .max(JOB_DESCRIPTION_MAX_LENGTH),
        limit: z.number().int().min(1).max(20).default(12),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await extractPortfolioSkills(input.description, input.limit);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Skills could not be suggested from this description.",
        });
      }
    }),

  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "CLOSED", "ARCHIVED"]).optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      let query = supabase.from("job_postings").select(JOB_SELECT);

      if (input.projectId) {
        await getProjectForAccess(supabase, input.projectId, ctx.user.id);
        query = query.eq("projectId", input.projectId);
      } else {
        const { data: memberships } = await supabase
          .from("organization_members")
          .select("workspaceId")
          .eq("userId", ctx.user.id);

        const orgIds = (memberships ?? []).map((m: { workspaceId: string }) => m.workspaceId);
        if (orgIds.length === 0) return [];

        const { data: projects } = await supabase
          .from("projects")
          .select("id")
          .in("organizationId", orgIds);

        const projectIds = (projects ?? []).map((project: { id: string }) => project.id);
        if (projectIds.length === 0) return [];

        query = query.in("projectId", projectIds);
      }

      if (input.status) {
        query = query.eq("status", input.status);
      }

      if (input.search?.trim()) {
        query = query.ilike("title", `%${input.search.trim()}%`);
      }

      const { data, error } = await query.order("updatedAt", { ascending: false });
      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return ((data ?? []) as JobPostingRecord[]).map((job) => ({
        ...shapeJob(job),
        publicApplicationUrl: publicApplicationUrl(job.publicSlug),
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const accessJob = await getJobForAccess(supabase, input.id, ctx.user.id);
      const [jobResult, sourceLinksResult, sourceVisitsResult] =
        await Promise.all([
          supabase
            .from("job_postings")
            .select(JOB_SELECT)
            .eq("id", accessJob.id)
            .single(),
          supabase
            .from("job_source_links")
            .select("*")
            .eq("jobId", accessJob.id)
            .order("createdAt", { ascending: true }),
          supabase
            .from("job_source_visits")
            .select("id,jobId,sourceLinkId,visitorId,applicationStartedAt")
            .eq("jobId", accessJob.id),
        ]);

      if (jobResult.error || !jobResult.data) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (sourceLinksResult.error || sourceVisitsResult.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            sourceLinksResult.error?.message ??
            sourceVisitsResult.error?.message ??
            "Failed to load source attribution.",
        });
      }

      const shaped = shapeJob(jobResult.data as JobPostingRecord);
      const sourceLinks = (sourceLinksResult.data ?? []) as JobSourceLinkRecord[];
      const sourceVisits = (sourceVisitsResult.data ?? []) as JobSourceVisitRecord[];
      return {
        ...shaped,
        publicApplicationUrl: publicApplicationUrl(shaped.publicSlug),
        sourceLinks: sourceLinks.map((link) => ({
          ...link,
          publicApplicationUrl: sourceApplicationUrl(
            shaped.publicSlug,
            link.trackingCode,
          ),
        })),
        attribution: summarizeJobAttribution(
          sourceLinks,
          sourceVisits,
          shaped.job_applications,
        ),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(2).max(140),
        department: z.string().max(100).optional(),
        location: z.string().max(120).optional(),
        employmentType: z.string().max(80).default("Full-time"),
        seniority: z.string().max(80).optional(),
        description: z.string().max(JOB_DESCRIPTION_MAX_LENGTH).optional(),
        skills: z.array(skillSchema).min(1).max(24),
        screeningQuestions: z.array(screeningQuestionSchema).max(12).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      await getProjectForAccess(supabase, input.projectId, ctx.user.id, "MEMBER");

      const publicSlug = createJobPublicSlug(input.title, nanoid(8));
      const { data: job, error } = await supabase
        .from("job_postings")
        .insert({
          projectId: input.projectId,
          userId: ctx.user.id,
          title: input.title,
          department: input.department,
          location: input.location,
          employmentType: input.employmentType,
          seniority: input.seniority,
          description: input.description,
          screeningQuestions: input.screeningQuestions,
          publicSlug,
        })
        .select()
        .single();

      if (error || !job) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Failed to create job.",
        });
      }

      const skills = input.skills.map((skill, index) => ({
        jobId: job.id,
        name: skill.name.trim(),
        kind: skill.kind,
        priority: skill.priority,
        lightcastId: skill.lightcastId ?? null,
        lightcastType: skill.lightcastType ?? null,
        lightcastDescription: skill.lightcastDescription ?? null,
        lightcastApiVersion: skill.lightcastApiVersion ?? null,
        lightcastCategoryId: skill.lightcastCategoryId ?? null,
        lightcastCategoryName: skill.lightcastCategoryName ?? null,
        lightcastSubcategoryId: skill.lightcastSubcategoryId ?? null,
        lightcastSubcategoryName: skill.lightcastSubcategoryName ?? null,
        skillSource: skill.lightcastId ? "LIGHTCAST" : "CUSTOM",
        displayOrder: index,
      }));

      const { error: skillsError } = await supabase.from("job_skills").insert(skills);
      if (skillsError) {
        await supabase.from("job_postings").delete().eq("id", job.id);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: skillsError.message,
        });
      }

      const { error: sourceLinksError } = await supabase
        .from("job_source_links")
        .insert(defaultSourceLinkRows(job.id));
      if (sourceLinksError) {
        await supabase.from("job_postings").delete().eq("id", job.id);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: sourceLinksError.message,
        });
      }

      return {
        ...job,
        publicApplicationUrl: publicApplicationUrl(publicSlug),
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(2).max(140).optional(),
        department: z.string().max(100).optional(),
        location: z.string().max(120).optional(),
        employmentType: z.string().max(80).optional(),
        seniority: z.string().max(80).optional(),
        description: z.string().max(JOB_DESCRIPTION_MAX_LENGTH).optional(),
        skills: z.array(skillSchema).min(1).max(24).optional(),
        screeningQuestions: z.array(screeningQuestionSchema).max(12).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const job = await getJobForAccess(supabase, input.id, ctx.user.id, "MEMBER");
      const { id, skills, ...patch } = input;

      const { data, error } = await supabase
        .from("job_postings")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Failed to update job.",
        });
      }

      if (skills) {
        await supabase.from("job_skills").delete().eq("jobId", job.id);
        const { error: skillError } = await supabase.from("job_skills").insert(
          skills.map((skill, index) => ({
            jobId: job.id,
            name: skill.name.trim(),
            kind: skill.kind,
            priority: skill.priority,
            lightcastId: skill.lightcastId ?? null,
            lightcastType: skill.lightcastType ?? null,
            lightcastDescription: skill.lightcastDescription ?? null,
            lightcastApiVersion: skill.lightcastApiVersion ?? null,
            lightcastCategoryId: skill.lightcastCategoryId ?? null,
            lightcastCategoryName: skill.lightcastCategoryName ?? null,
            lightcastSubcategoryId: skill.lightcastSubcategoryId ?? null,
            lightcastSubcategoryName: skill.lightcastSubcategoryName ?? null,
            skillSource: skill.lightcastId ? "LIGHTCAST" : "CUSTOM",
            displayOrder: index,
          })),
        );
        if (skillError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: skillError.message,
          });
        }
      }

      return data;
    }),

  transition: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        action: z.enum(["publish", "pause", "close", "archive", "restoreDraft"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const job = await getJobForAccess(supabase, input.id, ctx.user.id, "MEMBER");
      let nextStatus: JobStatus;
      try {
        nextStatus = getNextJobStatus(job.status, input.action as JobStatusAction);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Invalid job transition.",
        });
      }

      const timestamps: Record<string, string | null> = {};
      const now = new Date().toISOString();
      if (nextStatus === "ACTIVE") timestamps.publishedAt = now;
      if (nextStatus === "CLOSED") timestamps.closedAt = now;
      if (nextStatus === "ARCHIVED") timestamps.archivedAt = now;

      const { data, error } = await supabase
        .from("job_postings")
        .update({ status: nextStatus, ...timestamps })
        .eq("id", input.id)
        .select()
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Failed to update job status.",
        });
      }

      return data;
    }),

  applications: protectedProcedure
    .input(z.object({ jobId: z.string().optional(), projectId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      let jobIds: string[] = [];

      if (input.jobId) {
        const job = await getJobForAccess(supabase, input.jobId, ctx.user.id);
        jobIds = [job.id];
      } else if (input.projectId) {
        await getProjectForAccess(supabase, input.projectId, ctx.user.id);
        const { data: jobs } = await supabase
          .from("job_postings")
          .select("id")
          .eq("projectId", input.projectId);
        jobIds = (jobs ?? []).map((job: { id: string }) => job.id);
      } else {
        const jobs = await jobRouter.createCaller(ctx).list({});
        jobIds = jobs.map((job) => job.id);
      }

      if (jobIds.length === 0) return [];

      const { data, error } = await supabase
        .from("job_applications")
        .select("*, job_postings(id,title,status,projectId), job_source_links(name,channel)")
        .in("jobId", jobIds)
        .order("submittedAt", { ascending: false });

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return (data ?? []).map((application) => ({
        ...application,
        matchScore: null,
      }));
    }),

  getApplicationById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const { data, error } = await supabase
        .from("job_applications")
        .select("*, job_postings(id,title,status,projectId,publicSlug,department,location,employmentType,seniority,screeningQuestions,job_skills(*)), job_application_files(*), job_source_links(name,channel)")
        .eq("id", input.id)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await getJobForAccess(supabase, data.jobId, ctx.user.id, "VIEWER");
      const applicationFiles = await Promise.all(
        (
          (data.job_application_files ?? []) as Array<{
            storageBucket?: string | null;
            storagePath?: string | null;
          }>
        ).map(async (file) => ({
          ...file,
          url:
            file.storageBucket && file.storagePath
              ? await resolveStorageSignedUrl(
                  file.storageBucket,
                  file.storagePath,
                )
              : null,
        })),
      );
      return {
        ...data,
        matchScore: null,
        job_application_files: applicationFiles,
      };
    }),

  updateApplicationStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["NEW", "REVIEWED", "SHORTLISTED", "REJECTED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const { data: application } = await supabase
        .from("job_applications")
        .select("id, jobId")
        .eq("id", input.id)
        .single();

      if (!application) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await getJobForAccess(supabase, application.jobId, ctx.user.id, "MEMBER");

      const { data, error } = await supabase
        .from("job_applications")
        .update({ status: input.status })
        .eq("id", input.id)
        .select()
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Failed to update applicant.",
        });
      }

      return data;
    }),

  updateApplicationReview: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        reviewTier: z
          .enum(["TIER_1", "TIER_2", "TIER_3", "TIER_4", "TIER_5"])
          .nullable(),
        reviewNotes: z.string().trim().max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const { data: application } = await supabase
        .from("job_applications")
        .select("id, jobId")
        .eq("id", input.id)
        .single();

      if (!application) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await getJobForAccess(supabase, application.jobId, ctx.user.id, "MEMBER");

      const { data, error } = await supabase
        .from("job_applications")
        .update({
          reviewTier: input.reviewTier,
          reviewNotes: input.reviewNotes || null,
          reviewNotesUpdatedAt: new Date().toISOString(),
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Failed to save applicant review notes.",
        });
      }

      return data;
    }),

  getPublicBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const { data, error } = await supabase
        .from("job_postings")
        .select("*, job_skills(*)")
        .eq("publicSlug", input.slug)
        .eq("status", "ACTIVE")
        .single();

      if (error || !data) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return shapeJob({ ...(data as JobPostingRecord), job_applications: [] });
    }),

  createSourceLink: protectedProcedure
    .input(
      z.object({
        jobId: z.string().uuid(),
        name: z.string().trim().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const job = await getJobForAccess(
        supabase,
        input.jobId,
        ctx.user.id,
        "MEMBER",
      );
      const { data, error } = await supabase
        .from("job_source_links")
        .insert({
          jobId: job.id,
          name: input.name,
          channel: "CUSTOM",
          presetKey: null,
          trackingCode: `cu_${nanoid(12)}`,
        })
        .select()
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Failed to create source link.",
        });
      }

      return {
        ...data,
        publicApplicationUrl: sourceApplicationUrl(
          job.publicSlug,
          data.trackingCode,
        ),
      };
    }),

  setSourceLinkArchived: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        archived: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const { data: link, error: linkError } = await supabase
        .from("job_source_links")
        .select("id,jobId,channel")
        .eq("id", input.id)
        .single();

      if (linkError || !link) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await getJobForAccess(
        supabase,
        link.jobId,
        ctx.user.id,
        "MEMBER",
      );
      if (link.channel !== "CUSTOM") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Preset source links cannot be archived.",
        });
      }

      const { data, error } = await supabase
        .from("job_source_links")
        .update({ archivedAt: input.archived ? new Date().toISOString() : null })
        .eq("id", input.id)
        .select()
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Failed to update source link.",
        });
      }
      return data;
    }),

  trackSourceVisit: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(180),
        trackingCode: z.string().min(8).max(40),
        visitorId: z.string().min(8).max(100),
        event: z.enum(["VISIT", "START"]).default("VISIT"),
        landingPath: z.string().max(500).optional(),
        referrer: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const { data: job } = await supabase
        .from("job_postings")
        .select("id")
        .eq("publicSlug", input.slug)
        .eq("status", "ACTIVE")
        .single();
      if (!job) return { attributed: false as const };

      const { data: requestedLink } = await supabase
        .from("job_source_links")
        .select("id")
        .eq("jobId", job.id)
        .eq("trackingCode", input.trackingCode)
        .is("archivedAt", null)
        .single();
      if (!requestedLink) return { attributed: false as const };

      const now = new Date().toISOString();
      const { data: existingVisit } = await supabase
        .from("job_source_visits")
        .select("id,sourceLinkId,applicationStartedAt")
        .eq("jobId", job.id)
        .eq("visitorId", input.visitorId)
        .maybeSingle();

      if (existingVisit) {
        const patch: Record<string, string> = { lastVisitedAt: now };
        if (
          input.event === "START" &&
          !existingVisit.applicationStartedAt
        ) {
          patch.applicationStartedAt = now;
        }
        await supabase
          .from("job_source_visits")
          .update(patch)
          .eq("id", existingVisit.id);
        return {
          attributed: true as const,
          visitId: existingVisit.id,
          sourceLinkId: existingVisit.sourceLinkId,
        };
      }

      const { data: createdVisit, error } = await supabase
        .from("job_source_visits")
        .insert({
          jobId: job.id,
          sourceLinkId: requestedLink.id,
          visitorId: input.visitorId,
          landingPath: input.landingPath,
          referrer: input.referrer,
          applicationStartedAt: input.event === "START" ? now : null,
        })
        .select("id,sourceLinkId")
        .single();

      if (error || !createdVisit) {
        const { data: racedVisit } = await supabase
          .from("job_source_visits")
          .select("id,sourceLinkId")
          .eq("jobId", job.id)
          .eq("visitorId", input.visitorId)
          .maybeSingle();
        if (!racedVisit) return { attributed: false as const };
        return {
          attributed: true as const,
          visitId: racedVisit.id,
          sourceLinkId: racedVisit.sourceLinkId,
        };
      }

      return {
        attributed: true as const,
        visitId: createdVisit.id,
        sourceLinkId: createdVisit.sourceLinkId,
      };
    }),

  getDrawingAssessmentStatus: publicProcedure
    .input(
      z
        .object({
          portfolioUserId: z.string().min(1).max(160).optional(),
          identityLinkId: z.string().uuid().optional(),
          email: z.string().email().optional(),
        })
        .refine(
          (input) =>
            Boolean(
              input.portfolioUserId || input.identityLinkId || input.email,
            ),
          "A candidate identity is required.",
        ),
    )
    .query(async ({ ctx, input }) => {
      const assessment = await findReusableDrawingAssessment(
        ctx.supabase as SupabaseLike,
        input,
      );
      return assessment
        ? {
            reusable: true as const,
            completedAt: assessment.completedAt,
            expiresAt: assessment.expiresAt,
            responseCount: assessment.responses.length,
          }
        : {
            reusable: false as const,
            completedAt: null,
            expiresAt: null,
            responseCount: 0,
          };
    }),

  apply: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        portfolioUserId: z.string().optional(),
        identityLinkId: z.string().optional(),
        source: z
          .enum(["SKILIO", "GUEST", "DIRECT", "LINKEDIN", "JOBSTREET", "INDEED", "OTHER"])
          .default("GUEST"),
        sourceVisitorId: z.string().min(8).max(100).optional(),
        name: z.string().min(2).max(120),
        email: z.string().email(),
        phone: z.string().max(40).optional(),
        location: z.string().max(120).optional(),
        bio: z.string().max(1500).optional(),
        coverLetter: z.string().max(4000).optional(),
        skills: z.array(z.string().min(1).max(80)).max(40).default([]),
        skillDetails: z.array(applicationPortfolioSkillSchema).max(40).default([]),
        createSkilioAccount: z.boolean().default(false),
        profileSnapshot: z.record(z.string(), z.unknown()).default({}),
        screeningAnswers: z.record(z.string(), z.string().max(2000)).default({}),
        drawingResponses: drawingResponsesSchema.optional(),
        links: linksSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const { data: verifiedSkilioIdentity } = ctx.user
        ? await supabase
            .from("skilio_identity_links")
            .select("id,portfolioUserId,email")
            .eq("userId", ctx.user.id)
            .maybeSingle()
        : { data: null };
      const isVerifiedSkilioApplication = Boolean(
        input.source === "SKILIO" && verifiedSkilioIdentity,
      );
      const applicationSource =
        input.source === "SKILIO" && !isVerifiedSkilioApplication
          ? "GUEST"
          : input.source;
      const { data: job, error } = await supabase
        .from("job_postings")
        .select("*, job_skills(*)")
        .eq("publicSlug", input.slug)
        .eq("status", "ACTIVE")
        .single();

      if (error || !job) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const freshDrawingAssessment = input.drawingResponses
        ? createApplicationDrawingAssessment(input.drawingResponses)
        : null;
      const drawingAssessment =
        freshDrawingAssessment ??
        (await findReusableDrawingAssessment(supabase, {
          identityLinkId: input.identityLinkId,
          portfolioUserId: input.portfolioUserId,
          email: input.email,
        }));

      if (!drawingAssessment) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Complete all ten Drawmetrics drawings before submitting this application.",
        });
      }

      const { data: sourceVisit } = input.sourceVisitorId
        ? await supabase
            .from("job_source_visits")
            .select("id,sourceLinkId")
            .eq("jobId", job.id)
            .eq("visitorId", input.sourceVisitorId)
            .maybeSingle()
        : { data: null };

      const { data, error: insertError } = await supabase
        .from("job_applications")
        .insert({
          jobId: job.id,
          portfolioUserId: isVerifiedSkilioApplication
            ? verifiedSkilioIdentity?.portfolioUserId
            : null,
          identityLinkId: isVerifiedSkilioApplication
            ? verifiedSkilioIdentity?.id
            : null,
          source: applicationSource,
          applicationMethod: isVerifiedSkilioApplication ? "SKILIO" : "GUEST",
          sourceLinkId: sourceVisit?.sourceLinkId ?? null,
          sourceVisitId: sourceVisit?.id ?? null,
          name: input.name,
          email: input.email.trim().toLowerCase(),
          phone: input.phone,
          location: input.location,
          bio: input.bio,
          coverLetter: input.coverLetter,
          profileSnapshot: {
            ...input.profileSnapshot,
            drawingAssessment,
            drawingAssessmentReused: !freshDrawingAssessment,
          },
          screeningAnswers: input.screeningAnswers,
          skillsSnapshot: input.skills,
          links: input.links,
          matchScore: null,
        })
        .select()
        .single();

      if (insertError || !data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: insertError?.message ?? "Failed to submit application.",
        });
      }

      if (sourceVisit) {
        await supabase
          .from("job_source_visits")
          .update({
            applicationId: data.id,
            applicationSubmittedAt: new Date().toISOString(),
          })
          .eq("id", sourceVisit.id);
      }

      const portfolioProvisioning =
        isVerifiedSkilioApplication ||
        (input.createSkilioAccount && applicationSource !== "SKILIO")
          ? await runPortfolioProvisioning(supabase, {
              applicationId: data.id,
              portfolioUserId: isVerifiedSkilioApplication
                ? verifiedSkilioIdentity?.portfolioUserId
                : undefined,
              name: input.name,
              email: isVerifiedSkilioApplication
                ? verifiedSkilioIdentity?.email ?? input.email.trim().toLowerCase()
                : input.email.trim().toLowerCase(),
              country: input.location,
              phone: input.phone,
              selectedSkills: input.skills,
              jobSkills: (job.job_skills ?? []) as JobSkill[],
              skillDetails: input.skillDetails,
            })
          : null;

      return {
        ...data,
        portfolioProvisioning,
        fileUploadToken: createApplicationFileUploadToken(data.id),
      };
    }),

  retryPortfolioProvisioning: publicProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const { data: application, error } = await supabase
        .from("job_applications")
        .select(
          "id,name,email,phone,location,applicationMethod,skillsSnapshot,job_postings(job_skills(*)),job_application_provisioning(status,attempts)",
        )
        .eq("id", input.applicationId)
        .ilike("email", input.email.trim())
        .single();

      if (error || !application || application.applicationMethod === "SKILIO") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const provisioning = Array.isArray(application.job_application_provisioning)
        ? application.job_application_provisioning[0]
        : application.job_application_provisioning;
      if (
        provisioning?.status === "COMPLETED" ||
        provisioning?.status === "EXISTING_ACCOUNT"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This Skilio account is already ready.",
        });
      }
      if ((provisioning?.attempts ?? 0) >= 3) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "Account setup has reached its retry limit. Use the Skilio registration page with this email.",
        });
      }

      const posting = Array.isArray(application.job_postings)
        ? application.job_postings[0]
        : application.job_postings;
      return runPortfolioProvisioning(supabase, {
        applicationId: application.id,
        name: application.name,
        email: application.email,
        country: application.location,
        phone: application.phone,
        selectedSkills: Array.isArray(application.skillsSnapshot)
          ? application.skillsSnapshot.filter(
              (skill: unknown): skill is string => typeof skill === "string",
            )
          : [],
        jobSkills: ((posting?.job_skills ?? []) as JobSkill[]),
      });
    }),
});
