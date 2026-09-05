ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS "evidenceSnapshot" jsonb NOT NULL DEFAULT '{"artifacts":[],"portfolioSkills":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS "portfolioEdits" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE job_application_files
  ADD COLUMN IF NOT EXISTS "clientFileId" text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_application_files_client_id
  ON job_application_files ("applicationId", "clientFileId")
  WHERE "clientFileId" IS NOT NULL;
