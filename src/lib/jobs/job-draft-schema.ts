import { z } from "zod";
import {
  JOB_DESCRIPTION_MAX_LENGTH,
  JOB_DESCRIPTION_MIN_LENGTH,
} from "./job-description";

const emptyStringForNull = (value: unknown) =>
  value === null || value === undefined ? "" : value;

const optionalDraftText = (max: number) =>
  z.preprocess(emptyStringForNull, z.string().trim().max(max));

export const jobDraftScreeningQuestionSchema = z.object({
  prompt: z.string().trim().min(3).max(300),
  type: z.enum(["TEXT", "YES_NO", "SELECT"]).default("TEXT"),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
});

export const jobDraftSchema = z.object({
  title: z.string().trim().min(2).max(140),
  department: optionalDraftText(100),
  location: optionalDraftText(120),
  employmentType: z.enum([
    "Full-time",
    "Part-time",
    "Contract",
    "Internship",
  ]),
  seniority: z.enum(["Entry-level", "Mid-level", "Senior", "Lead"]),
  description: z
    .string()
    .trim()
    .min(JOB_DESCRIPTION_MIN_LENGTH)
    .max(JOB_DESCRIPTION_MAX_LENGTH),
  skillQueries: z
    .array(z.string().trim().min(1).max(80))
    .max(24)
    .default([]),
  screeningQuestions: z
    .array(jobDraftScreeningQuestionSchema)
    .max(12)
    .default([]),
  warnings: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
});

export const jobDraftGenerationRequestSchema = z.object({
  source: z.enum(["brief", "document"]),
  content: z.string().trim().min(20).max(15_000),
  fileName: z.string().trim().max(240).optional(),
});

export type JobDraft = z.infer<typeof jobDraftSchema>;
export type JobDraftScreeningQuestion = z.infer<
  typeof jobDraftScreeningQuestionSchema
>;
export type JobDraftGenerationRequest = z.infer<
  typeof jobDraftGenerationRequestSchema
>;

export function normalizeJobDraft(draft: JobDraft): JobDraft {
  const seenSkills = new Set<string>();
  const skillQueries = draft.skillQueries.filter((skill) => {
    const key = skill.toLowerCase();
    if (seenSkills.has(key)) return false;
    seenSkills.add(key);
    return true;
  });

  return {
    ...draft,
    description: draft.description
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    skillQueries,
    screeningQuestions: draft.screeningQuestions.map((question) => ({
      ...question,
      options:
        question.type === "SELECT"
          ? question.options.map((option) => option.trim()).filter(Boolean)
          : [],
    })),
  };
}
