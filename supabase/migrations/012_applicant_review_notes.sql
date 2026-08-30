DO $$ BEGIN
  CREATE TYPE "JobApplicationReviewTier" AS ENUM (
    'TIER_1',
    'TIER_2',
    'TIER_3',
    'TIER_4',
    'TIER_5'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS "reviewTier" "JobApplicationReviewTier",
  ADD COLUMN IF NOT EXISTS "reviewNotes" text,
  ADD COLUMN IF NOT EXISTS "reviewNotesUpdatedAt" timestamptz;

DO $$ BEGIN
  ALTER TABLE job_applications
    ADD CONSTRAINT job_applications_review_notes_length
    CHECK (char_length("reviewNotes") <= 4000);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_job_applications_review_tier
  ON job_applications ("reviewTier");
