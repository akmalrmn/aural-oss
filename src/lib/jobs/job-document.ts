import JSZip from "jszip";
import * as mammoth from "mammoth";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (
  buffer: Buffer,
) => Promise<{ text: string }>;

export const MAX_JOB_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const MAX_JOB_DOCUMENT_TEXT = 15_000;
const MAX_DOCX_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_DOCX_EXPANDED_BYTES = 32 * 1024 * 1024;
const MAX_DOCX_ENTRIES = 2_000;
export const JOB_DOCUMENT_ACCEPT =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

type JobDocumentType = "PDF" | "DOCX" | "TXT";

export class JobDocumentError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 = 400,
  ) {
    super(message);
    this.name = "JobDocumentError";
  }
}

function extension(fileName: string) {
  return fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

export function detectJobDocumentType(
  fileName: string,
  bytes: Uint8Array,
): JobDocumentType {
  const ext = extension(fileName);
  const isPdf =
    bytes.length >= 5 &&
    String.fromCharCode(
      bytes[0] ?? 0,
      bytes[1] ?? 0,
      bytes[2] ?? 0,
      bytes[3] ?? 0,
      bytes[4] ?? 0,
    ) === "%PDF-";
  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(bytes[2] ?? -1) &&
    [0x04, 0x06, 0x08].includes(bytes[3] ?? -1);

  if (ext === "pdf" && isPdf) return "PDF";
  if (ext === "docx" && isZip) return "DOCX";
  if (ext === "txt" && !bytes.includes(0)) return "TXT";

  if (!["pdf", "docx", "txt"].includes(ext)) {
    throw new JobDocumentError("Upload a PDF, DOCX, or TXT job description.");
  }
  throw new JobDocumentError(
    "The file content does not match its extension. Export it again and retry.",
  );
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function validateDocxArchive(buffer: Buffer) {
  try {
    const archive = await JSZip.loadAsync(buffer);
    const entries = Object.values(archive.files);
    if (entries.length > MAX_DOCX_ENTRIES) {
      throw new JobDocumentError(
        "The DOCX contains too many embedded files. Export a simpler document and retry.",
        413,
      );
    }

    let expandedBytes = 0;
    for (const entry of entries) {
      if (entry.dir) continue;
      const compressedData = (
        entry as typeof entry & {
          _data?: { uncompressedSize?: number };
        }
      )._data;
      const entryBytes = compressedData?.uncompressedSize ?? 0;
      if (entryBytes > MAX_DOCX_ENTRY_BYTES) {
        throw new JobDocumentError(
          "The DOCX contains an embedded file that is too large to process.",
          413,
        );
      }
      expandedBytes += entryBytes;
      if (expandedBytes > MAX_DOCX_EXPANDED_BYTES) {
        throw new JobDocumentError(
          "The expanded DOCX is too large to process.",
          413,
        );
      }
    }
  } catch (error) {
    if (error instanceof JobDocumentError) throw error;
    throw new JobDocumentError(
      "The DOCX archive is invalid. Export it again and retry.",
    );
  }
}

export async function extractJobDocument(file: File) {
  if (!file.name?.trim()) {
    throw new JobDocumentError("Choose a job-description file.");
  }
  if (file.size === 0) {
    throw new JobDocumentError("The selected file is empty.");
  }
  if (file.size > MAX_JOB_DOCUMENT_BYTES) {
    throw new JobDocumentError(
      "The job description must be 8 MB or smaller.",
      413,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const documentType = detectJobDocumentType(file.name, buffer);
  const warnings: string[] = [];
  let text = "";

  if (documentType === "PDF") {
    text = (await pdfParse(buffer)).text ?? "";
  } else if (documentType === "DOCX") {
    await validateDocxArchive(buffer);
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
    warnings.push(
      ...result.messages
        .filter((message) => message.type === "warning")
        .map((message) => message.message)
        .slice(0, 3),
    );
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new JobDocumentError(
        "The TXT file must use UTF-8 text encoding.",
      );
    }
  }

  text = normalizeExtractedText(text);
  if (text.length < 80) {
    throw new JobDocumentError(
      "The file does not contain enough readable job-description text.",
    );
  }
  if (text.length > MAX_JOB_DOCUMENT_TEXT) {
    text = text.slice(0, MAX_JOB_DOCUMENT_TEXT);
    warnings.push(
      "Only the first 15,000 characters were used to create this draft.",
    );
  }

  return {
    fileName: file.name.slice(0, 240),
    documentType,
    text,
    warnings,
  };
}
