import { getAuthUser } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { consumeJobAuthoringRateLimit } from "@/lib/jobs/job-authoring-rate-limit";
import { generateJobDraft } from "@/lib/jobs/job-draft-generator";
import {
  extractJobDocument,
  JobDocumentError,
  MAX_JOB_DOCUMENT_BYTES,
} from "@/lib/jobs/job-document";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Context } from "@/server/context";
import {
  getEffectiveProjectRole,
  getOrgMembership,
  hasMinRole,
  hasProjectAccess,
} from "@/server/trpc";

export const runtime = "nodejs";

const log = createLogger("api/jobs/draft/import");
const MAX_REQUEST_BYTES = MAX_JOB_DOCUMENT_BYTES + 256 * 1024;

async function canAuthorJobsInProject(projectId: string, userId: string) {
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("organizationId")
    .eq("id", projectId)
    .single();
  if (!project) return false;

  const client = supabaseAdmin as unknown as Context["supabase"];
  const membership = await getOrgMembership(
    client,
    project.organizationId,
    userId,
  );
  if (!membership) return false;
  if (!(await hasProjectAccess(client, projectId, userId))) return false;

  const role = await getEffectiveProjectRole(
    client,
    projectId,
    userId,
    membership.role,
  );
  return hasMinRole(role, "MEMBER");
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Sign in to import a job description." }, {
      status: 401,
    });
  }

  if (process.env.JOB_AI_AUTHORING_ENABLED === "false") {
    return Response.json(
      { error: "AI job authoring is currently unavailable." },
      { status: 503 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: "The job description must be 8 MB or smaller." },
      { status: 413 },
    );
  }

  const retryAfter = consumeJobAuthoringRateLimit(`job-draft:${user.id}`);
  if (retryAfter) {
    return Response.json(
      { error: `Too many authoring requests. Retry in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const startedAt = Date.now();
  try {
    const formData = await request.formData();
    const projectId = formData.get("projectId");
    if (
      typeof projectId !== "string" ||
      !projectId.trim() ||
      !(await canAuthorJobsInProject(projectId, user.id))
    ) {
      return Response.json(
        { error: "You do not have permission to author jobs in this workspace." },
        { status: 403 },
      );
    }

    const file = formData.get("file");
    if (
      !file ||
      typeof file === "string" ||
      typeof file.arrayBuffer !== "function"
    ) {
      return Response.json(
        { error: "Choose a PDF, DOCX, or TXT job description." },
        { status: 400 },
      );
    }

    const extracted = await extractJobDocument(file as File);
    const draft = await generateJobDraft({
      source: "document",
      content: extracted.text,
      fileName: extracted.fileName,
    });

    log.info("Job document imported", {
      userId: user.id,
      projectId,
      documentType: extracted.documentType,
      fileBytes: file.size,
      extractedCharacters: extracted.text.length,
      durationMs: Date.now() - startedAt,
    });

    return Response.json({
      draft: {
        ...draft,
        warnings: [...extracted.warnings, ...draft.warnings].slice(0, 8),
      },
      fileName: extracted.fileName,
      documentType: extracted.documentType,
    });
  } catch (error) {
    if (error instanceof JobDocumentError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    log.error("Job document import failed", {
      userId: user.id,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      {
        error:
          "The job description could not be interpreted. Check the file and retry.",
      },
      { status: 502 },
    );
  }
}
