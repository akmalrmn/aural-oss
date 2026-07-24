ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS "screeningQuestions" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS "screeningAnswers" jsonb NOT NULL DEFAULT '{}'::jsonb;
