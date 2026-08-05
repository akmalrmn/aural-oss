UPDATE storage.buckets
SET
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'application/octet-stream'
  ]
WHERE id = 'job-application-files';

UPDATE job_applications
SET "matchScore" = NULL
WHERE "matchScore" IS NOT NULL;

UPDATE job_applications
SET "profileSnapshot" = jsonb_set(
  jsonb_set(
    "profileSnapshot",
    '{drawingAssessment,score}',
    'null'::jsonb,
    true
  ),
  '{drawingAssessment,scoreMode}',
  '"UNSCORED"'::jsonb,
  true
)
WHERE jsonb_typeof("profileSnapshot"->'drawingAssessment') = 'object';

UPDATE messages
SET "whiteboardData" =
  ("whiteboardData" - 'hardcodedScore') ||
  jsonb_build_object('score', NULL, 'scoreMode', 'UNSCORED')
WHERE "whiteboardData"->>'assessmentMode' = 'DRAWING';
