import {
  APPLICATION_FILE_BUCKET,
  getApplicationFileExtension,
  MAX_APPLICATION_FILES,
  MAX_APPLICATION_FILE_BYTES,
  normalizeApplicationFileSkills,
  type ApplicationFileKind,
  validateApplicationFile,
} from "@/lib/jobs/application-files";
import { verifyApplicationFileUploadToken } from "@/lib/jobs/application-file-upload-token";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = MAX_APPLICATION_FILE_BYTES + 256 * 1024;
const clientFileIdPattern = /^[a-zA-Z0-9_-]{8,80}$/;

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return errorResponse("Artefacts must be 100 MB or smaller.", 413);
  }

  const formData = await request.formData();
  const applicationId = formData.get("applicationId");
  const token = formData.get("token");
  const clientFileId = formData.get("clientFileId");
  const kind = formData.get("kind");
  const skillNamesValue = formData.get("skillNames");
  const file = formData.get("file");

  if (
    typeof applicationId !== "string" ||
    typeof token !== "string" ||
    typeof clientFileId !== "string" ||
    !clientFileIdPattern.test(clientFileId) ||
    (kind !== "resume" && kind !== "skill_artifact") ||
    !file ||
    typeof file === "string" ||
    typeof file.arrayBuffer !== "function"
  ) {
    return errorResponse("The file upload request is invalid.", 400);
  }

  if (!verifyApplicationFileUploadToken(token, applicationId)) {
    return errorResponse("This file upload session has expired.", 401);
  }

  const applicationFileKind = kind as ApplicationFileKind;
  const validationError = validateApplicationFile(file, applicationFileKind);
  if (validationError) return errorResponse(validationError, 400);

  let skillNames: string[] = [];
  if (applicationFileKind === "skill_artifact") {
    try {
      skillNames = normalizeApplicationFileSkills(
        typeof skillNamesValue === "string"
          ? JSON.parse(skillNamesValue)
          : [],
      );
    } catch {
      return errorResponse("The artefact skill tags are invalid.", 400);
    }
    if (skillNames.length === 0) {
      return errorResponse("Choose at least one skill for this artefact.", 400);
    }
  }

  const { count, error: countError } = await supabaseAdmin
    .from("job_application_files")
    .select("id", { count: "exact", head: true })
    .eq("applicationId", applicationId);
  if (countError) {
    return errorResponse("The attachment could not be checked.", 500);
  }

  const extension = getApplicationFileExtension(file.name);
  const storagePath = `${applicationId}/${clientFileId}.${extension}`;
  const { data: existing } = await supabaseAdmin
    .from("job_application_files")
    .select("id")
    .eq("storagePath", storagePath)
    .maybeSingle();
  if (!existing && (count ?? 0) >= MAX_APPLICATION_FILES) {
    return errorResponse(
      `An application can include up to ${MAX_APPLICATION_FILES} files.`,
      400,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(APPLICATION_FILE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
  if (uploadError) {
    return errorResponse("The file could not be uploaded. Please retry.", 500);
  }

  const { data, error: recordError } = await supabaseAdmin
    .from("job_application_files")
    .upsert(
      {
        applicationId,
        kind: applicationFileKind,
        fileName: file.name.trim().slice(0, 255),
        fileType: file.type || null,
        fileSize: file.size,
        storageBucket: APPLICATION_FILE_BUCKET,
        storagePath,
        skillNames,
      },
      { onConflict: "storagePath" },
    )
    .select("id,fileName,kind,skillNames")
    .single();

  if (recordError || !data) {
    await supabaseAdmin.storage
      .from(APPLICATION_FILE_BUCKET)
      .remove([storagePath]);
    return errorResponse("The file could not be attached. Please retry.", 500);
  }

  return Response.json({ file: data });
}
