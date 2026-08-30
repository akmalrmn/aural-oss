import { NextRequest } from "next/server";
import { z } from "zod";
import {
  ApplicationEvidenceError,
  extractEvidenceFile,
  extractEvidenceUrl,
  generateEvidenceSummary,
  MAX_EVIDENCE_DOCUMENT_BYTES,
} from "@/lib/jobs/application-evidence";
import {
  extractPortfolioSkills,
  searchPortfolioSkills,
} from "@/lib/skilio-service-client";
import { createLogger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const WINDOW_MS = 60_000;
const MAX_EXTRACTIONS_PER_WINDOW = 5;
const MAX_SEARCHES_PER_WINDOW = 30;
const requests = new Map<string, { count: number; resetAt: number }>();
const log = createLogger("api/jobs/application-skill-evidence");

const linkSchema = z.object({
  slug: z.string().trim().min(1).max(180),
  url: z.string().trim().min(8).max(2_000),
});

function clientIdentifier(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function consumeRateLimit(key: string, maxRequests: number) {
  const now = Date.now();
  const current = requests.get(key);
  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  current.count += 1;
  if (current.count <= maxRequests) return null;
  return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
}

async function requireActiveJob(slug: string) {
  const { data } = await supabaseAdmin
    .from("job_postings")
    .select("id")
    .eq("publicSlug", slug)
    .eq("status", "ACTIVE")
    .maybeSingle();
  return Boolean(data);
}

function errorResponse(error: string, status: number, retryAfter?: number) {
  return Response.json(
    { error },
    {
      status,
      headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
    },
  );
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim() ?? "";
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (slug.length === 0 || query.length < 2 || query.length > 80) {
    return errorResponse("Enter at least two characters to search skills.", 400);
  }
  if (!(await requireActiveJob(slug))) {
    return errorResponse("This application is no longer available.", 404);
  }

  const retryAfter = consumeRateLimit(
    `search:${clientIdentifier(request)}`,
    MAX_SEARCHES_PER_WINDOW,
  );
  if (retryAfter) {
    return errorResponse(
      `Too many skill searches. Retry in ${retryAfter}s.`,
      429,
      retryAfter,
    );
  }

  try {
    const skills = await searchPortfolioSkills(query, 10);
    return Response.json({ skills });
  } catch (error) {
    log.warn("Public skill search failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return errorResponse("The skill catalogue is temporarily unavailable.", 502);
  }
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_EVIDENCE_DOCUMENT_BYTES + 256 * 1024) {
    return errorResponse("Files analyzed for skills must be 8 MB or smaller.", 413);
  }

  const retryAfter = consumeRateLimit(
    `extract:${clientIdentifier(request)}`,
    MAX_EXTRACTIONS_PER_WINDOW,
  );
  if (retryAfter) {
    return errorResponse(
      `Too many evidence analyses. Retry in ${retryAfter}s.`,
      429,
      retryAfter,
    );
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let slug = "";
    let sourceName = "";
    let sourceUrl: string | null = null;
    let text = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const slugValue = formData.get("slug");
      const file = formData.get("file");
      if (
        typeof slugValue !== "string" ||
        !file ||
        typeof file === "string" ||
        typeof file.arrayBuffer !== "function"
      ) {
        return errorResponse("Choose a file to analyze.", 400);
      }
      slug = slugValue.trim();
      sourceName = file.name.trim().slice(0, 240);
      if (!(await requireActiveJob(slug))) {
        return errorResponse("This application is no longer available.", 404);
      }
      text = await extractEvidenceFile(file);
    } else {
      const input = linkSchema.parse(await request.json());
      slug = input.slug;
      if (!(await requireActiveJob(slug))) {
        return errorResponse("This application is no longer available.", 404);
      }
      const extracted = await extractEvidenceUrl(input.url);
      text = extracted.text;
      sourceUrl = extracted.finalUrl;
      sourceName = new URL(extracted.finalUrl).hostname;
    }

    const skills = await extractPortfolioSkills(text, 12);
    const summary = await generateEvidenceSummary(text, skills);
    return Response.json({ skills, summary, sourceName, sourceUrl });
  } catch (error) {
    if (error instanceof ApplicationEvidenceError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof z.ZodError) {
      return errorResponse("Enter a complete public portfolio or case-study link.", 400);
    }
    log.warn("Public evidence analysis failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return errorResponse(
      "We could not analyze this evidence. Add its skills manually or retry.",
      502,
    );
  }
}
