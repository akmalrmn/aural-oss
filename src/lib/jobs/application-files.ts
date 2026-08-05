export const APPLICATION_FILE_BUCKET = "job-application-files";
export const MAX_APPLICATION_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_RESUME_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_APPLICATION_FILES = 10;

export type ApplicationFileKind = "resume" | "skill_artifact";

type FileDescriptor = {
  name: string;
  size: number;
  type: string;
};

const fileRules: Record<
  ApplicationFileKind,
  Record<string, readonly string[]>
> = {
  resume: {
    pdf: ["application/pdf"],
    doc: ["application/msword"],
    docx: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  skill_artifact: {
    pdf: ["application/pdf"],
    doc: ["application/msword"],
    docx: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    png: ["image/png"],
    jpg: ["image/jpeg"],
    jpeg: ["image/jpeg"],
    webp: ["image/webp"],
    mp4: ["video/mp4"],
  },
};

export function getApplicationFileByteLimit(kind: ApplicationFileKind) {
  return kind === "resume"
    ? MAX_RESUME_FILE_BYTES
    : MAX_APPLICATION_FILE_BYTES;
}

export function getApplicationFileExtension(fileName: string) {
  return fileName.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

export function validateApplicationFile(
  file: FileDescriptor,
  kind: ApplicationFileKind,
): string | null {
  if (!file.name.trim()) return "The selected file must have a name.";
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return "The selected file is empty.";
  }
  const maxBytes = getApplicationFileByteLimit(kind);
  if (file.size > maxBytes) {
    return kind === "resume"
      ? "Resume files must be 10 MB or smaller."
      : "Artefacts must be 100 MB or smaller.";
  }

  const extension = getApplicationFileExtension(file.name);
  const allowedTypes = fileRules[kind][extension];
  if (!allowedTypes) {
    return kind === "resume"
      ? "Resume files must be PDF, DOC, or DOCX."
      : "Artefacts must be PDF, DOC, DOCX, PNG, JPG, WEBP, or MP4.";
  }

  const normalizedType = file.type.trim().toLowerCase();
  if (
    normalizedType &&
    normalizedType !== "application/octet-stream" &&
    !allowedTypes.includes(normalizedType)
  ) {
    return "The file type does not match its extension.";
  }

  return null;
}

export function normalizeApplicationFileSkills(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(
      (item, index, all) =>
        item.length > 0 &&
        item.length <= 80 &&
        all.findIndex(
          (candidate) =>
            candidate.trim().toLowerCase() === item.toLowerCase(),
        ) === index,
    )
    .slice(0, 20);
}

export function applicationFileFingerprint(file: FileDescriptor) {
  return `${file.name.trim().toLowerCase()}:${file.size}:${file.type.trim().toLowerCase()}`;
}
