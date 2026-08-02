import "server-only";

import { generateChatWithFallback } from "@/lib/ai/generator-run";
import { createLogger } from "@/lib/logger";
import {
  jobDraftGenerationRequestSchema,
  type JobDraft,
  type JobDraftGenerationRequest,
} from "./job-draft-schema";
import {
  buildJobDraftMessages,
  parseJobDraftResponse,
} from "./job-draft-prompt";

const log = createLogger("jobs/job-draft-generator");

function validationSummary(error: unknown) {
  if (!error || typeof error !== "object" || !("issues" in error)) {
    return error instanceof Error ? error.message : "Invalid JSON output.";
  }
  const issues = (error as {
    issues?: Array<{ path?: PropertyKey[]; message?: string }>;
  }).issues;
  return (issues ?? [])
    .slice(0, 12)
    .map((issue) => `${issue.path?.join(".") || "draft"}: ${issue.message}`)
    .join("\n");
}

export async function generateJobDraft(
  input: JobDraftGenerationRequest,
): Promise<JobDraft> {
  const request = jobDraftGenerationRequestSchema.parse(input);
  const startedAt = Date.now();
  const first = await generateChatWithFallback({
    messages: buildJobDraftMessages(request),
    temperature: 0.2,
    maxTokens: 3000,
  });

  try {
    const draft = parseJobDraftResponse(first.content);
    log.info("Job draft generated", {
      source: request.source,
      durationMs: Date.now() - startedAt,
      totalTokens: first.usage?.totalTokens ?? null,
      repaired: false,
    });
    return draft;
  } catch (firstError) {
    const repaired = await generateChatWithFallback({
      messages: [
        ...buildJobDraftMessages(request),
        { role: "assistant", content: first.content.slice(0, 12_000) },
        {
          role: "user",
          content: `The output failed validation:
${validationSummary(firstError)}

Return a corrected JSON object only. Preserve supported facts and satisfy the exact contract.`,
        },
      ],
      temperature: 0,
      maxTokens: 3000,
    });

    const draft = parseJobDraftResponse(repaired.content);
    log.info("Job draft generated", {
      source: request.source,
      durationMs: Date.now() - startedAt,
      totalTokens:
        (first.usage?.totalTokens ?? 0) + (repaired.usage?.totalTokens ?? 0),
      repaired: true,
    });
    return draft;
  }
}
