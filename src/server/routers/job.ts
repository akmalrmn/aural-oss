import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "@/lib/id";
import type { Context } from "@/server/context";
import {
  computeApplicationMatch,
  createJobPublicSlug,
  getNextJobStatus,
  summarizeJobApplications,
  type ApplicationStatus,
  type JobStatus,
  type JobStatusAction,
} from "@/lib/jobs/job-utils";
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
  job_applications(id,status,source,matchScore,submittedAt,name,email)
`;

const skillSchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(["HARD", "SOFT"]).default("HARD"),
  priority: z.enum(["MUST", "NICE"]).default("MUST"),
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

type SupabaseLike = Context["supabase"];

type JobSkill = {
  id: string;
  jobId: string;
  name: string;
  kind: "HARD" | "SOFT";
  priority: "MUST" | "NICE";
  displayOrder: number;
};

type JobApplicationListItem = {
  id: string;
  status: ApplicationStatus;
  source: string | null;
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
  const applications = (job.job_applications ?? []) as JobApplicationListItem[];
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

export const jobRouter = router({
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
      const { data, error } = await supabase
        .from("job_postings")
        .select(JOB_SELECT)
        .eq("id", accessJob.id)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const shaped = shapeJob(data as JobPostingRecord);
      return {
        ...shaped,
        publicApplicationUrl: publicApplicationUrl(shaped.publicSlug),
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
        description: z.string().max(6000).optional(),
        skills: z.array(skillSchema).min(1).max(24),
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
        description: z.string().max(6000).optional(),
        skills: z.array(skillSchema).min(1).max(24).optional(),
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
        .select("*, job_postings(id,title,status,projectId)")
        .in("jobId", jobIds)
        .order("submittedAt", { ascending: false });

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data ?? [];
    }),

  getApplicationById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const { data, error } = await supabase
        .from("job_applications")
        .select("*, job_postings(id,title,status,projectId,publicSlug,department,location,employmentType,seniority), job_application_files(*)")
        .eq("id", input.id)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await getJobForAccess(supabase, data.jobId, ctx.user.id, "VIEWER");
      return data;
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

  apply: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        portfolioUserId: z.string().optional(),
        identityLinkId: z.string().optional(),
        source: z
          .enum(["SKILIO", "GUEST", "DIRECT", "LINKEDIN", "JOBSTREET", "INDEED", "OTHER"])
          .default("GUEST"),
        name: z.string().min(2).max(120),
        email: z.string().email(),
        phone: z.string().max(40).optional(),
        location: z.string().max(120).optional(),
        bio: z.string().max(1500).optional(),
        coverLetter: z.string().max(4000).optional(),
        skills: z.array(z.string().min(1).max(80)).max(40).default([]),
        profileSnapshot: z.record(z.string(), z.unknown()).default({}),
        links: linksSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = ctx.supabase as SupabaseLike;
      const { data: job, error } = await supabase
        .from("job_postings")
        .select("*, job_skills(*)")
        .eq("publicSlug", input.slug)
        .eq("status", "ACTIVE")
        .single();

      if (error || !job) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const skills = ((job.job_skills ?? []) as JobSkill[]).map((skill) => ({
        name: skill.name,
        priority: skill.priority,
      }));
      const matchScore = computeApplicationMatch({
        requiredSkills: skills
          .filter((skill) => skill.priority === "MUST")
          .map((skill) => skill.name),
        optionalSkills: skills
          .filter((skill) => skill.priority === "NICE")
          .map((skill) => skill.name),
        candidateSkills: input.skills,
      });

      const { data, error: insertError } = await supabase
        .from("job_applications")
        .insert({
          jobId: job.id,
          portfolioUserId: input.portfolioUserId,
          identityLinkId: input.identityLinkId,
          source: input.source,
          name: input.name,
          email: input.email,
          phone: input.phone,
          location: input.location,
          bio: input.bio,
          coverLetter: input.coverLetter,
          profileSnapshot: input.profileSnapshot,
          skillsSnapshot: input.skills,
          links: input.links,
          matchScore,
        })
        .select()
        .single();

      if (insertError || !data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: insertError?.message ?? "Failed to submit application.",
        });
      }

      return data;
    }),
});
