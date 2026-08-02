export const DEFAULT_HIRING_WORKSPACE_NAME = "Hiring";

type EmployerSignupDetails = {
  companyName: string;
  fullName: string;
};

export function normalizePersonName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeCompanyName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function buildEmployerSignupMetadata({
  companyName,
  fullName,
}: EmployerSignupDetails) {
  return {
    account_type: "employer",
    company_name: normalizeCompanyName(companyName),
    full_name: normalizePersonName(fullName),
    initial_workspace_name: DEFAULT_HIRING_WORKSPACE_NAME,
  };
}

export function getInviteDisplayName(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const words = localPart
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "Invited teammate";

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
