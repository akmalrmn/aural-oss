-- ============================================================
-- Skilio Job Portal
-- Employer job postings, candidate applications, and portfolio
-- identity links. Uses existing projects/organizations for access.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "JobPostingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "JobApplicationStatus" AS ENUM ('NEW', 'REVIEWED', 'SHORTLISTED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "JobSkillKind" AS ENUM ('HARD', 'SOFT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "JobSkillPriority" AS ENUM ('MUST', 'NICE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "JobApplicationSource" AS ENUM ('SKILIO', 'GUEST', 'DIRECT', 'LINKEDIN', 'JOBSTREET', 'INDEED', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS skilio_identity_links (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "portfolioUserId"  text NOT NULL,
  email              text NOT NULL,
  username           text,
  name               text,
  "avatarUrl"        text,
  "profileSnapshot"  jsonb NOT NULL DEFAULT '{}'::jsonb,
  "skillsSnapshot"   jsonb NOT NULL DEFAULT '[]'::jsonb,
  "lastSyncedAt"     timestamptz NOT NULL DEFAULT now(),
  "createdAt"        timestamptz NOT NULL DEFAULT now(),
  "updatedAt"        timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("userId"),
  UNIQUE ("portfolioUserId")
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON skilio_identity_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS job_postings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId"       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  "userId"          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             text NOT NULL,
  department        text,
  location          text,
  "employmentType"  text NOT NULL DEFAULT 'Full-time',
  seniority         text,
  description       text,
  status            "JobPostingStatus" NOT NULL DEFAULT 'DRAFT',
  "publicSlug"      text NOT NULL UNIQUE,
  "publishedAt"     timestamptz,
  "closedAt"        timestamptz,
  "archivedAt"      timestamptz,
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  "updatedAt"       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_project ON job_postings ("projectId");
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings (status);
CREATE INDEX IF NOT EXISTS idx_job_postings_public_slug ON job_postings ("publicSlug");

CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_postings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS job_skills (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId"        uuid NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  name           text NOT NULL,
  kind           "JobSkillKind" NOT NULL DEFAULT 'HARD',
  priority       "JobSkillPriority" NOT NULL DEFAULT 'MUST',
  "displayOrder" int NOT NULL DEFAULT 0,
  "createdAt"    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_skills_job ON job_skills ("jobId");
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_skills_unique_name
  ON job_skills ("jobId", lower(name));

CREATE TABLE IF NOT EXISTS job_applications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId"            uuid NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  "portfolioUserId"  text,
  "identityLinkId"   uuid REFERENCES skilio_identity_links(id) ON DELETE SET NULL,
  source             "JobApplicationSource" NOT NULL DEFAULT 'GUEST',
  status             "JobApplicationStatus" NOT NULL DEFAULT 'NEW',
  name               text NOT NULL,
  email              text NOT NULL,
  phone              text,
  location           text,
  bio                text,
  "coverLetter"      text,
  "profileSnapshot"  jsonb NOT NULL DEFAULT '{}'::jsonb,
  "skillsSnapshot"   jsonb NOT NULL DEFAULT '[]'::jsonb,
  links              jsonb NOT NULL DEFAULT '{}'::jsonb,
  "matchScore"       int CHECK ("matchScore" >= 0 AND "matchScore" <= 100),
  "submittedAt"      timestamptz NOT NULL DEFAULT now(),
  "createdAt"        timestamptz NOT NULL DEFAULT now(),
  "updatedAt"        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications ("jobId");
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications (status);
CREATE INDEX IF NOT EXISTS idx_job_applications_email ON job_applications (email);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS job_application_files (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "applicationId"    uuid NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  kind               text NOT NULL DEFAULT 'resume',
  "fileName"         text NOT NULL,
  "fileType"         text,
  "fileSize"         int,
  "storageBucket"    text,
  "storagePath"      text,
  "createdAt"        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_application_files_application
  ON job_application_files ("applicationId");

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_application_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE skilio_identity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages job portal data"
  ON job_postings FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role manages job skills"
  ON job_skills FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role manages job applications"
  ON job_applications FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role manages job application files"
  ON job_application_files FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can read their Skilio identity link"
  ON skilio_identity_links FOR SELECT
  USING (auth.uid() = "userId");

CREATE POLICY "Service role manages Skilio identity links"
  ON skilio_identity_links FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
