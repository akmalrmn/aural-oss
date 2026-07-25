ALTER TABLE job_skills
  ADD COLUMN IF NOT EXISTS "lightcastId" text,
  ADD COLUMN IF NOT EXISTS "lightcastType" text,
  ADD COLUMN IF NOT EXISTS "lightcastDescription" text,
  ADD COLUMN IF NOT EXISTS "lightcastApiVersion" text,
  ADD COLUMN IF NOT EXISTS "lightcastCategoryId" text,
  ADD COLUMN IF NOT EXISTS "lightcastCategoryName" text,
  ADD COLUMN IF NOT EXISTS "lightcastSubcategoryId" text,
  ADD COLUMN IF NOT EXISTS "lightcastSubcategoryName" text,
  ADD COLUMN IF NOT EXISTS "skillSource" text NOT NULL DEFAULT 'CUSTOM';

ALTER TABLE job_skills
  DROP CONSTRAINT IF EXISTS job_skills_skill_source_check;

ALTER TABLE job_skills
  ADD CONSTRAINT job_skills_skill_source_check
  CHECK ("skillSource" IN ('LIGHTCAST', 'CUSTOM'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_skills_unique_lightcast
  ON job_skills ("jobId", "lightcastId")
  WHERE "lightcastId" IS NOT NULL;

DO $$
BEGIN
  CREATE TYPE "PortfolioProvisioningStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'EXISTING_ACCOUNT',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS job_application_provisioning (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "applicationId"          uuid NOT NULL UNIQUE
                           REFERENCES job_applications(id) ON DELETE CASCADE,
  status                   "PortfolioProvisioningStatus" NOT NULL DEFAULT 'PENDING',
  attempts                 int NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  "portfolioUserId"        text,
  username                 text,
  "nextUrl"                text,
  "activationEmailSent"    boolean,
  "lastError"              text,
  "consentedAt"            timestamptz NOT NULL DEFAULT now(),
  "lastAttemptAt"          timestamptz,
  "completedAt"            timestamptz,
  "createdAt"              timestamptz NOT NULL DEFAULT now(),
  "updatedAt"              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_application_provisioning_status
  ON job_application_provisioning (status);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_application_provisioning
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE job_application_provisioning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages job application provisioning"
  ON job_application_provisioning FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
