DO $$
BEGIN
  CREATE TYPE "JobApplicationMethod" AS ENUM ('SKILIO', 'GUEST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS job_source_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId"        uuid NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  channel        text NOT NULL CHECK (
    channel IN ('LINKEDIN', 'JOBSTREET', 'INDEED', 'CUSTOM')
  ),
  "presetKey"    text CHECK (
    "presetKey" IS NULL OR
    "presetKey" IN ('LINKEDIN', 'JOBSTREET', 'INDEED')
  ),
  "trackingCode" text NOT NULL UNIQUE CHECK (
    char_length("trackingCode") BETWEEN 8 AND 40
  ),
  "archivedAt"   timestamptz,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_source_links_preset
  ON job_source_links ("jobId", "presetKey")
  WHERE "presetKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_source_links_job
  ON job_source_links ("jobId");

CREATE INDEX IF NOT EXISTS idx_job_source_links_tracking
  ON job_source_links ("trackingCode");

CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_source_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS job_source_visits (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId"                uuid NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  "sourceLinkId"         uuid NOT NULL REFERENCES job_source_links(id) ON DELETE CASCADE,
  "visitorId"            text NOT NULL CHECK (char_length("visitorId") BETWEEN 8 AND 100),
  "landingPath"          text,
  referrer               text,
  "firstVisitedAt"       timestamptz NOT NULL DEFAULT now(),
  "lastVisitedAt"        timestamptz NOT NULL DEFAULT now(),
  "applicationStartedAt" timestamptz,
  "applicationSubmittedAt" timestamptz,
  "applicationId"        uuid REFERENCES job_applications(id) ON DELETE SET NULL,
  "createdAt"            timestamptz NOT NULL DEFAULT now(),
  "updatedAt"            timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("jobId", "visitorId")
);

CREATE INDEX IF NOT EXISTS idx_job_source_visits_job
  ON job_source_visits ("jobId");

CREATE INDEX IF NOT EXISTS idx_job_source_visits_link
  ON job_source_visits ("sourceLinkId");

CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_source_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS "applicationMethod" "JobApplicationMethod"
  NOT NULL DEFAULT 'GUEST';

UPDATE job_applications
SET "applicationMethod" =
  CASE WHEN source = 'SKILIO' THEN 'SKILIO'::"JobApplicationMethod"
       ELSE 'GUEST'::"JobApplicationMethod"
  END;

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS "sourceLinkId" uuid
  REFERENCES job_source_links(id) ON DELETE SET NULL;

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS "sourceVisitId" uuid
  REFERENCES job_source_visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_applications_source_link
  ON job_applications ("sourceLinkId");

ALTER TABLE job_source_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_source_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages job source links"
  ON job_source_links FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role manages job source visits"
  ON job_source_visits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

INSERT INTO job_source_links (
  "jobId",
  name,
  channel,
  "presetKey",
  "trackingCode"
)
SELECT
  job.id,
  preset.name,
  preset.channel,
  preset.channel,
  lower(preset.prefix || replace(gen_random_uuid()::text, '-', ''))
FROM job_postings AS job
CROSS JOIN (
  VALUES
    ('LinkedIn', 'LINKEDIN', 'li_'),
    ('JobStreet', 'JOBSTREET', 'js_'),
    ('Indeed', 'INDEED', 'in_')
) AS preset(name, channel, prefix)
ON CONFLICT DO NOTHING;
